export interface PhoneNumber {
  label: string;
  number: string;
  id?: string;
}

export interface Contact {
  id: string;
  name: string;
  phoneNumbers: PhoneNumber[];
  needsFix: boolean;
} 