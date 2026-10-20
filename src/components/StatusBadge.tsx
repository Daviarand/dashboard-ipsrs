import { Badge } from '@/components/ui/badge';
import { getStatusColor, getStatusLabel } from '@/lib/labels';
import type { Enums } from '@/types/database';

interface StatusBadgeProps {
  status: Enums<'ticket_status'>;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const color = getStatusColor(status) as 'slate' | 'blue' | 'amber' | 'orange' | 'green' | 'red';
  const label = getStatusLabel(status);

  return (
    <Badge variant={color} className={className}>
      {label}
    </Badge>
  );
}
