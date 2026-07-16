export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

const PASSWORD_MIN_LENGTH = 12;

export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();

  if (!trimmed) {
    return { valid: false, error: 'Email is required.' };
  }

  if (!EMAIL_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Enter a valid email address.' };
  }

  return { valid: true };
}

export interface PasswordRequirementStatus {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  symbol: boolean;
}

export function getPasswordRequirementStatus(password: string): PasswordRequirementStatus {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[^A-Za-z0-9]/.test(password),
  };
}

export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, error: 'Password is required.' };
  }

  const status = getPasswordRequirementStatus(password);

  if (!status.minLength) {
    return { valid: false, error: 'Password must be at least 12 characters.' };
  }

  if (!status.uppercase) {
    return { valid: false, error: 'Password must include an uppercase letter.' };
  }

  if (!status.lowercase) {
    return { valid: false, error: 'Password must include a lowercase letter.' };
  }

  if (!status.number) {
    return { valid: false, error: 'Password must include a number.' };
  }

  if (!status.symbol) {
    return { valid: false, error: 'Password must include a symbol.' };
  }

  return { valid: true };
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): ValidationResult {
  const passwordResult = validatePassword(password);
  if (!passwordResult.valid) {
    return passwordResult;
  }

  if (password !== confirmation) {
    return { valid: false, error: 'Passwords do not match.' };
  }

  return { valid: true };
}

/**
 * Validates phone numbers in E.164 format (e.g. +14045551234).
 */
export function validatePhoneE164(phone: string): ValidationResult {
  const trimmed = phone.trim();

  if (!trimmed) {
    return { valid: false, error: 'Phone number is required.' };
  }

  if (!E164_PATTERN.test(trimmed)) {
    return {
      valid: false,
      error: 'Enter a valid phone number in E.164 format (e.g. +14045551234).',
    };
  }

  return { valid: true };
}

/**
 * Normalizes common US phone input to E.164 when possible.
 * Returns null when the value cannot be normalized.
 */
export function normalizePhoneToE164(input: string, defaultCountryCode = '1'): string | null {
  const digits = input.replace(/\D/g, '');

  if (!digits) return null;

  if (input.trim().startsWith('+') && E164_PATTERN.test(`+${digits}`)) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+${defaultCountryCode}${digits}`;
  }

  if (digits.length === 11 && digits.startsWith(defaultCountryCode)) {
    return `+${digits}`;
  }

  if (E164_PATTERN.test(`+${digits}`)) {
    return `+${digits}`;
  }

  return null;
}

export function validateRequired(value: string, fieldLabel = 'This field'): ValidationResult {
  if (!value.trim()) {
    return { valid: false, error: `${fieldLabel} is required.` };
  }
  return { valid: true };
}
