export interface StableTextareaProps {
  autoHeight?: boolean;
  className?: string;
  disabled?: boolean;
  focus?: boolean;
  maxlength?: number;
  name?: string;
  placeholder?: string;
  value: string;
  onValueChange: (value: string) => void;
}
