resource "aws_security_group" "pods" {
  name        = "${var.project_name}-pods-sg"
  description = "Security group dedicated to EKS pods"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-pods-sg"
  }
}

output "pods_security_group_id" {
  value = aws_security_group.pods.id
}