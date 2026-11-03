import { AppController } from './app.controller.js';

describe('AppController', () => {
  it('health retorna ok', () => {
    expect(new AppController().health()).toEqual({ status: 'ok' });
  });
});
