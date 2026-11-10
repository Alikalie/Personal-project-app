import type { Href } from 'expo-router';
import type { AuthContextValue } from '../components/AuthProvider';

export function routeFor(ctx: AuthContextValue['ctx']): Href {
  return ctx ? '/(tabs)' : '/welcome';
}
