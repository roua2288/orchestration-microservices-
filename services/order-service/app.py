import os

import pybreaker
import requests
from flask import Flask, jsonify
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

app = Flask(__name__)

PAYMENT_SERVICE_URL = os.getenv(
    "PAYMENT_SERVICE_URL",
    "http://orchestration-app-payment-service"
)

CONNECT_TIMEOUT = float(os.getenv("CONNECT_TIMEOUT", "2"))
READ_TIMEOUT = float(os.getenv("READ_TIMEOUT", "3"))

# Retry : 1 appel initial + 2 nouvelles tentatives.
retry_policy = Retry(
    total=2,
    connect=2,
    read=2,
    status=2,
    backoff_factor=0.5,
    status_forcelist=[500, 502, 503, 504],
    allowed_methods=frozenset(["GET"]),
    raise_on_status=False,
)

session = requests.Session()
session.mount("http://", HTTPAdapter(max_retries=retry_policy))
session.mount("https://", HTTPAdapter(max_retries=retry_policy))

# Circuit Breaker :
# ouverture après 3 appels logiques en échec ;
# nouvelle tentative après 30 secondes.
payment_breaker = pybreaker.CircuitBreaker(
    fail_max=3,
    reset_timeout=30,
    name="payment-service"
)


@payment_breaker
def call_payment_service():
    response = session.get(
        PAYMENT_SERVICE_URL,
        timeout=(CONNECT_TIMEOUT, READ_TIMEOUT)
    )
    response.raise_for_status()
    return response


@app.get("/")
def home():
    return jsonify(
        service="order-service",
        status="operational",
        payment_service=PAYMENT_SERVICE_URL,
        circuit_breaker=payment_breaker.current_state,
    )


@app.get("/health")
def health():
    return jsonify(
        status="healthy",
        service="order-service"
    )


@app.get("/orders/<order_id>/payment")
def get_payment(order_id):
    try:
        response = call_payment_service()

        return jsonify(
            order_id=order_id,
            payment_status="available",
            payment_http_status=response.status_code,
            circuit_breaker=payment_breaker.current_state,
        ), 200

    except pybreaker.CircuitBreakerError:
        return jsonify(
            order_id=order_id,
            payment_status="temporarily_unavailable",
            circuit_breaker="open",
            message="Payment service circuit breaker is open"
        ), 503

    except requests.RequestException as error:
        return jsonify(
            order_id=order_id,
            payment_status="error",
            circuit_breaker=payment_breaker.current_state,
            message=str(error)
        ), 502


@app.get("/resilience/status")
def resilience_status():
    return jsonify(
        payment_service=PAYMENT_SERVICE_URL,
        connect_timeout_seconds=CONNECT_TIMEOUT,
        read_timeout_seconds=READ_TIMEOUT,
        retry_attempts=3,
        circuit_breaker_state=payment_breaker.current_state,
        circuit_breaker_failure_threshold=3,
        circuit_breaker_reset_timeout_seconds=30,
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)