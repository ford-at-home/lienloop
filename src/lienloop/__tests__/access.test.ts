import { describe, expect, it } from 'vitest';
import { requireOperator } from '../access';

describe('Invited-account desk access', () => {
  it('refuses signed-out users', async () => {
    await expect(requireOperator(async () => ({ data: { user: null }, error: null }))).rejects.toMatchObject({ options: { to: '/auth' } });
  });
  it('refuses an unvalidated cached identity', async () => {
    await expect(requireOperator(async () => ({ data: { user: { id: 'cached' } }, error: new Error('Invalid token') }))).rejects.toMatchObject({ options: { to: '/auth' } });
  });
  it('fails closed when authentication cannot be reached', async () => {
    await expect(requireOperator(async () => { throw new Error('Offline'); })).rejects.toMatchObject({ options: { to: '/auth' } });
  });
  it('allows a validated existing account', async () => {
    const user = { id: 'operator' };
    await expect(requireOperator(async () => ({ data: { user }, error: null }))).resolves.toEqual(user);
  });
});