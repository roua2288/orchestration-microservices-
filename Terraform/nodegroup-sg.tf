resource "aws_eks_node_group" "security_groups" {
  cluster_name    = aws_eks_cluster.this.name
  node_group_name = "${var.cluster_name}-sg-ng"
  node_role_arn   = aws_iam_role.eks_nodes.arn

  subnet_ids = aws_subnet.private[*].id

  scaling_config {
    desired_size = 1
    min_size     = 1
    max_size     = 2
  }

  capacity_type  = "ON_DEMAND"
  instance_types = ["m5.large"]

  labels = {
    role            = "security-groups"
    pod-eni-enabled = "true"
  }

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_node_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_ecr_read_only,
    aws_iam_role_policy_attachment.eks_vpc_resource_controller
  ]

  lifecycle {
    ignore_changes = [
      scaling_config[0].desired_size,
      scaling_config[0].min_size
    ]
  }
}