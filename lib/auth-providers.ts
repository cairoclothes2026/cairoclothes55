import type { Provider } from '@supabase/supabase-js';

export type AuthAccountType = 'customer' | 'merchant';

export type OAuthAuthMethod = {
  id: Provider;
  kind: 'oauth';
  label: string;
  mark: string;
  scopes?: string;
  emailOtpOnSignupFor?: readonly AuthAccountType[];
};

type EmailAuthMethod = { id: 'email'; kind: 'email'; label: string };

export const AUTH_METHODS: readonly (EmailAuthMethod | OAuthAuthMethod)[] = [
  { id: 'email', kind: 'email', label: 'Email' },
  { id: 'google', kind: 'oauth', label: 'Google', mark: 'G', emailOtpOnSignupFor: ['merchant'] },
  { id: 'facebook', kind: 'oauth', label: 'Facebook', mark: 'f', scopes: 'email' },
];

export type SocialAuthProvider = Provider;
export const SOCIAL_AUTH_PROVIDERS = AUTH_METHODS.filter(
  (method): method is OAuthAuthMethod => method.kind === 'oauth',
);
