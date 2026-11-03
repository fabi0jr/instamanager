import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { App } from './App';

test('App renderiza o título', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'instamanager' })).toBeTruthy();
});
