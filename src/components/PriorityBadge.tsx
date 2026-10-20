import { Badge } from '@/components/ui/badge';
import { getPriorityColor, getPriorityLabel } from '@/lib/labels';
import type { Enums } from '@/types/database';

interface PriorityBadgeProps {
  priority: Enums<'ticket_priority'>;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const color = getPriorityColor(priority) as 'slate' | 'blue' | 'amber' | 'orange' | 'green' | 'red';
  const label = getPriorityLabel(priority);

  return (
    <Badge variant={color} className={className}>
      {label}
    </Badge>
  );
}
