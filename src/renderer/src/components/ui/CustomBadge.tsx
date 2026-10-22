import Badge from "../dash-ui-kit-enxtended/badge";
import { CUSTOM_BADGE_VARIANTS } from "@renderer/constants/customBadge";
import type { CustomBadgeProps } from "@renderer/types/CustomBadge";

export default function CustomBadge({variant = 'default', text, icon, size = 'xs', className = ''}: CustomBadgeProps): React.JSX.Element
{
  const { className: variantClassName = '', ...variantBadge } = CUSTOM_BADGE_VARIANTS[variant]

  return (
    <Badge {...variantBadge} size={size} className={`gap-1 !text-[.625rem] leading-[120%] ${variantClassName} ${className}`}>
      {icon}{text}
    </Badge>
  )
}
