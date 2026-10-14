"use client";

import {
  Award,
  BadgeCheck,
  Briefcase,
  Building2,
  CircleQuestionMark,
  Coins,
  GraduationCap,
  Handshake,
  Landmark,
  Leaf,
  Package,
  PackageCheck,
  Swords,
  Tag,
  Target,
  Truck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { CompanyTypeIconName } from "@/types/company-type";

const ICONS: Record<CompanyTypeIconName, LucideIcon> = {
  unclassified: CircleQuestionMark,
  prospect: Target,
  customer: BadgeCheck,
  partner: Handshake,
  competitor: Swords,
  supplier: Package,
  authority: Landmark,
  research: GraduationCap,
  investor: Coins,
  ngo: Leaf,
  grant: Award,
  association: Users,
  offtaker: PackageCheck,
  service: Wrench,
  consultant: Briefcase,
  distributor: Truck,
  internal: Building2,
  other: Tag,
};

export function CompanyTypeIcon({
  icon,
  size = 12,
  className = "",
}: {
  icon: CompanyTypeIconName;
  size?: number;
  className?: string;
}) {
  const Icon = ICONS[icon] ?? Tag;
  return <Icon size={size} strokeWidth={1.75} className={`shrink-0 ${className}`} aria-hidden />;
}
