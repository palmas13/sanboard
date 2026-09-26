import { LoginContent } from './LoginContent';
import { isTestLoginEnabled } from '@/lib/auth/test-login';

export const dynamic = 'force-dynamic';

export default function GirisPage() {
  return <LoginContent testLoginEnabled={isTestLoginEnabled()} />;
}
