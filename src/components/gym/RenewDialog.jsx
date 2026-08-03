import React, { useEffect, useMemo, useState } from 'react';

import { RefreshCw, Calendar, ArrowUpDown } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { addDays, formatCurrency, formatDate, todayISO, daysRemaining, logAudit } from '@/lib/gym';
import { useToast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';

export default function RenewDialog({ open, onOpenChange, member, currentMembership, plans = [], onSaved, mode = 'renew' }) {
  const isSwitch = mode === 'switch';
  const { toast } = useToast();
  const [planId, setPlanId] = useState('');
  const [customStart, setCustomStart] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [customDuration, setCustomDuration] = useState('');
  const [customFee, setCustomFee] = useState('');
  const [discount, setDiscount] = useState('');
  const [saving, setSaving] = useState(false);

  const activePlans = useMemo(() => plans.filter((p) => p.active), [plans]);

  useEffect(() => {
    if (open && activePlans.length && !planId) setPlanId(activePlans[0].id);