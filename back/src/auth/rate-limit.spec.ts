import { ipBucket, RateLimiter } from './rate-limit.js';

describe('RateLimiter', () => {
  it('libera até o máximo e depois devolve os segundos de espera', () => {
    const limiter = new RateLimiter();
    expect(limiter.check([['k', 2, 60_000]], 0)).toBe(0);
    expect(limiter.check([['k', 2, 60_000]], 0)).toBe(0);
    expect(limiter.check([['k', 2, 60_000]], 30_000)).toBe(30);
  });

  it('chaves são independentes e a janela zera ao vencer', () => {
    const limiter = new RateLimiter();
    limiter.check([['a', 1, 1000]], 0);
    expect(limiter.check([['b', 1, 1000]], 0)).toBe(0);
    expect(limiter.check([['a', 1, 1000]], 500)).toBe(1);
    expect(limiter.check([['a', 1, 1000]], 1000)).toBe(0);
  });

  it('com o IP estourado, as chaves de e-mail nem são criadas', () => {
    const limiter = new RateLimiter();
    limiter.check([['ip', 1, 60_000]], 0);
    const antes = limiter.size;
    for (let i = 0; i < 50; i++) expect(limiter.check([['ip', 1, 60_000], [`email:${i}`, 10, 60_000]], 0)).toBe(60);
    expect(limiter.size).toBe(antes);
  });

  it('teto duro: acima de 100 mil chaves descarta a mais antiga', () => {
    const limiter = new RateLimiter();
    for (let i = 0; i <= 100_000; i++) limiter.check([[`k${i}`, 5, 60_000]], 0);
    expect(limiter.size).toBe(100_000);
    // k0 foi descartada: começa do zero
    for (let i = 0; i < 5; i++) expect(limiter.check([['k0', 5, 60_000]], 0)).toBe(0);
  });
});

describe('RateLimiter no teto', () => {
  it('com vencidas no Map, o teto varre as vencidas e não descarta as válidas', () => {
    const limiter = new RateLimiter();
    limiter.check([['valida', 1, 3_600_000]], 0);
    for (let i = 0; i < 100_000; i++) limiter.check([[`curta${i}`, 5, 1000]], 0);
    expect(limiter.size).toBe(100_000); // a mais antiga (válida) saiu: tudo era válido no instante 0
    limiter.check([['valida2', 1, 3_600_000]], 0);
    // passado 1 min, as curtas venceram: o próximo teto varre elas, sem tocar em valida2
    for (let i = 0; i < 99_999; i++) limiter.check([[`nova${i}`, 5, 3_600_000]], 120_000);
    expect(limiter.check([['valida2', 1, 3_600_000]], 120_000)).toBeGreaterThan(0);
  });
});

describe('ipBucket', () => {
  it('IPv4 inteiro, IPv4 mapeado em IPv6 vira IPv4', () => {
    expect(ipBucket('203.0.113.7')).toBe('203.0.113.7');
    expect(ipBucket('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('dois IPv6 do mesmo /64 caem na mesma chave; /64 diferente não', () => {
    expect(ipBucket('2001:db8:1:2::1')).toBe('2001:db8:1:2::/64');
    expect(ipBucket('2001:0db8:0001:0002:ffff:aaaa:bbbb:cccc')).toBe('2001:db8:1:2::/64');
    expect(ipBucket('2001:db8::5')).toBe('2001:db8:0:0::/64');
    expect(ipBucket('2001:db8:1:3::1')).not.toBe(ipBucket('2001:db8:1:2::1'));
  });

  it('IPv6 do mesmo /64 contam juntos no limitador', () => {
    const limiter = new RateLimiter();
    const limite = (ip: string) => limiter.check([[`login:ip:${ipBucket(ip)}`, 1, 60_000]], 0);
    expect(limite('2001:db8:1:2::a')).toBe(0);
    expect(limite('2001:db8:1:2::b')).toBe(60);
  });
});

describe('RateLimiter.esquecer', () => {
  it('apaga só as chaves com o prefixo', () => {
    const limiter = new RateLimiter();
    limiter.check([['login:email-ip:a@b.co 1.1.1.1', 1, 60_000]], 0);
    limiter.check([['login:email-ip:a@b.co 2.2.2.2', 1, 60_000]], 0);
    limiter.check([['login:email-ip:c@d.co 1.1.1.1', 1, 60_000]], 0);
    limiter.esquecer('login:email-ip:a@b.co ');
    expect(limiter.size).toBe(1);
    expect(limiter.check([['login:email-ip:a@b.co 1.1.1.1', 1, 60_000]], 0)).toBe(0);
  });
});
