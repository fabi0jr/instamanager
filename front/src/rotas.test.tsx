import { act, renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import { navegar, useRota } from './rotas';

test('rota /p/abc → params.id = abc', () => {
  history.pushState(null, '', '/p/abc');
  const { result } = renderHook(() => useRota());
  expect(result.current.params.id).toBe('abc');
  act(() => navegar('/c/palmeiras'));
  expect(result.current.params.id).toBe('palmeiras');
  expect(result.current.caminho).toBe('/c/palmeiras');
});
