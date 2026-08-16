resource "aws_eks_node_group" "spot" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "${var.cluster_name}-spot-ng"
  node_role_arn   = aws_iam_role.eks_nodes.arn

  subnet_ids = aws_subnet.private[*].id

  capacity_type  = "SPOT"
  instance_types = ["t3.medium"]

  scaling_config {
    desired_size = 1
    min_size     = 0
    max_size     = 2
  }

  update_config {
    max_unavailable = 1
  }

  labels = {
    role     = "non-critical"
    capacity = "spot"
  }

  tags = {
    Project     = "orchestration-microservices"
    Environment = "dev"
    ManagedBy   = "Terraform"
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_ecr_read_only
  ]
}