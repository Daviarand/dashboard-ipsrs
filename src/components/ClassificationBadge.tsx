import { Badge } from '@/components/ui/badge';
import { getClassificationColor, getClassificationLabel } from '@/lib/labels';
import type { Enums } from '@/types/database';

interface ClassificationBadgeProps {
  classification: Enums<'ticket_classification'> | null | undefined;
  className?: string;
}

export function ClassificationBadge({ classification, className }: ClassificationBadgeProps) {
  if (!classification) {
    return <span className="text-slate-400 text-xs">-</span>;
  }

  const color = getClassificationColor(classification) as 'green' | 'red';
  const label = getClassificationLabel(classification);

  return (
    <Badge variant={color} className={className}>
      {label}
    </Badge>
  );
}
