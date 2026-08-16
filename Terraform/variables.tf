variable "region" {
  description = "Region AWS"
  type        = string
  default     = "eu-west-3"
}

variable "project_name" {
  description = "Nom du projet"
  type        = string
  default     = "orchestration-microservices"
}

variable "environment" {
  description = "Environnement"
  type        = string
  default     = "dev"
}

variable "cluster_name" {
  description = "Nom du cluster EKS"
  type        = string
  default     = "orchestration-eks"
}

variable "cluster_version" {
  description = "Version du cluster EKS"
  type        = string
  default     = "1.30"
}

variable "vpc_cidr" {
  description = "CIDR du VPC"
  type        = string
  default     = "10.10.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "CIDR des subnets publiques"
  type        = list(string)
  default     = ["10.10.1.0/24", "10.10.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "CIDR des subnets privées"
  type        = list(string)
  default     = ["10.10.11.0/24", "10.10.12.0/24"]
}

variable "node_instance_type" {
  description = "Instance type du node group"
  type        = string
  default     = "t3.medium"
}

variable "desired_size" {
  description = "Nombre de nœuds souhaités"
  type        = number
  default     = 2
}

variable "min_size" {
  description = "Nombre minimum de nœuds"
  type        = number
  default     = 1
}

variable "max_size" {
  description = "Nombre maximum de nœuds"
  type        = number
  default     = 3
}
