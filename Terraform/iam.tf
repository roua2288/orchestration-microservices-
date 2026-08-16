####################################################
# Fournisseur OIDC du cluster EKS
####################################################

data "tls_certificate" "eks_oidc" {
  url = aws_eks_cluster.this.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "eks" {
  url = aws_eks_cluster.this.identity[0].oidc[0].issuer

  client_id_list = [
    "sts.amazonaws.com"
  ]

  thumbprint_list = [
    data.tls_certificate.eks_oidc.certificates[0].sha1_fingerprint
  ]

  tags = {
    Name = "${var.cluster_name}-oidc-provider"
  }
}

####################################################
# Trust Policy IRSA de l'application
####################################################

data "aws_iam_policy_document" "irsa_assume_role" {
  statement {
    effect = "Allow"

    actions = [
      "sts:AssumeRoleWithWebIdentity"
    ]

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
        "system:serviceaccount:default:app-sa"
      ]
    }

    condition {
      test = "StringEquals"

      variable = "${replace(
        aws_iam_openid_connect_provider.eks.url,
        "https://",
        ""
      )}:aud"

      values = [
        "sts.amazonaws.com"
      ]
    }
  }
}

####################################################
# Rôle IAM associé au ServiceAccount app-sa
####################################################

resource "aws_iam_role" "irsa_role" {
  name = "${var.cluster_name}-irsa-role"

  assume_role_policy = data.aws_iam_policy_document.irsa_assume_role.json

  tags = {
    Name = "${var.cluster_name}-irsa-role"
  }
}

####################################################
# Permissions S3
####################################################

resource "aws_iam_role_policy_attachment" "irsa_s3" {
  role       = aws_iam_role.irsa_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3FullAccess"
}

####################################################
# Permissions DynamoDB
####################################################

resource "aws_iam_role_policy_attachment" "irsa_dynamodb" {
  role       = aws_iam_role.irsa_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess"
}

####################################################
# Permissions SQS
####################################################

resource "aws_iam_role_policy_attachment" "irsa_sqs" {
  role       = aws_iam_role.irsa_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSQSFullAccess"
}

####################################################
# IAM Policy du Cluster Autoscaler
####################################################

data "aws_iam_policy_document" "cluster_autoscaler_permissions" {
  statement {
    sid    = "ClusterAutoscalerReadOnly"
    effect = "Allow"

    actions = [
      "autoscaling:DescribeAutoScalingGroups",
      "autoscaling:DescribeAutoScalingInstances",
      "autoscaling:DescribeLaunchConfigurations",
      "autoscaling:DescribeScalingActivities",
      "autoscaling:DescribeTags",
      "ec2:DescribeImages",
      "ec2:DescribeInstanceTypes",
      "ec2:DescribeLaunchTemplateVersions",
      "ec2:GetInstanceTypesFromInstanceRequirements",
      "eks:DescribeNodegroup"
    ]

    resources = ["*"]
  }

  statement {
    sid    = "ClusterAutoscalerWrite"
    effect = "Allow"

    actions = [
      "autoscaling:SetDesiredCapacity",
      "autoscaling:TerminateInstanceInAutoScalingGroup"
    ]

    resources = ["*"]

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/k8s.io/cluster-autoscaler/enabled"
      values   = ["true"]
    }

    condition {
      test     = "StringEquals"
      variable = "aws:ResourceTag/k8s.io/cluster-autoscaler/${var.cluster_name}"
      values   = ["owned"]
    }
  }
}

resource "aws_iam_policy" "cluster_autoscaler" {
  name        = "${var.cluster_name}-cluster-autoscaler-policy"
  description = "Permissions IAM pour le Cluster Autoscaler EKS"

  policy = data.aws_iam_policy_document.cluster_autoscaler_permissions.json

  tags = {
    Name = "${var.cluster_name}-cluster-autoscaler-policy"
  }
}

####################################################
# Trust Policy IRSA du Cluster Autoscaler
####################################################

data "aws_iam_policy_document" "cluster_autoscaler_assume_role" {
  statement {
    effect = "Allow"

    actions = [
      "sts:AssumeRoleWithWebIdentity"
    ]

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
        "system:serviceaccount:kube-system:cluster-autoscaler"
      ]
    }

    condition {
      test = "StringEquals"

      variable = "${replace(
        aws_iam_openid_connect_provider.eks.url,
        "https://",
        ""
      )}:aud"

      values = [
        "sts.amazonaws.com"
      ]
    }
  }
}

####################################################
# Rôle IAM IRSA du Cluster Autoscaler
####################################################

resource "aws_iam_role" "cluster_autoscaler" {
  name = "${var.cluster_name}-cluster-autoscaler-role"

  assume_role_policy = data.aws_iam_policy_document.cluster_autoscaler_assume_role.json

  tags = {
    Name = "${var.cluster_name}-cluster-autoscaler-role"
  }
}

resource "aws_iam_role_policy_attachment" "cluster_autoscaler" {
  role       = aws_iam_role.cluster_autoscaler.name
  policy_arn = aws_iam_policy.cluster_autoscaler.arn
}

####################################################
# Outputs
####################################################

output "irsa_role_arn" {
  description = "ARN du rôle IAM associé au ServiceAccount app-sa"
  value       = aws_iam_role.irsa_role.arn
}

output "cluster_autoscaler_role_arn" {
  description = "ARN du rôle IRSA du Cluster Autoscaler"
  value       = aws_iam_role.cluster_autoscaler.arn
}