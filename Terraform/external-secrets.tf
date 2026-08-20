####################################################
# IRSA pour External Secrets Operator
####################################################

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "external_secrets_permissions" {
  statement {
    effect = "Allow"

    actions = [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret"
    ]

    resources = [
      "arn:aws:secretsmanager:${var.region}:${data.aws_caller_identity.current.account_id}:secret:orchestration/microservices/*"
    ]
  }
}

resource "aws_iam_policy" "external_secrets" {
  name        = "${var.cluster_name}-external-secrets-policy"
  description = "Lecture des secrets applicatifs depuis AWS Secrets Manager"

  policy = data.aws_iam_policy_document.external_secrets_permissions.json
}

data "aws_iam_policy_document" "external_secrets_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type = "Federated"

      identifiers = [
        aws_iam_openid_connect_provider.eks.arn
      ]
    }

    condition {
      test = "StringEquals"

      variable = "${replace(
        aws_iam_openid_connect_provider.eks.url,
        "https://",
        ""
      )}:sub"

      values = [
        "system:serviceaccount:external-secrets:external-secrets"
      ]
    }

    condition {
      test = "StringEquals"

      variable = "${replace(
        aws_iam_openid_connect_provider.eks.url,
        "https://",
        ""
      )}:aud"

      values = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "external_secrets" {
  name = "${var.cluster_name}-external-secrets-role"

  assume_role_policy = data.aws_iam_policy_document.external_secrets_assume_role.json

  tags = {
    Name = "${var.cluster_name}-external-secrets-role"
  }
}

resource "aws_iam_role_policy_attachment" "external_secrets" {
  role       = aws_iam_role.external_secrets.name
  policy_arn = aws_iam_policy.external_secrets.arn
}

output "external_secrets_role_arn" {
  description = "Role IAM utilise par External Secrets Operator"
  value       = aws_iam_role.external_secrets.arn
}