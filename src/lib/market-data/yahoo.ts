type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: Array<number | null> }> };
    }>;
  };
};

type YahooSearchResponse = {
  quotes?: Array<{
    symbol?: string;
    longname?: string;
    shortname?: string;
  }>;
};

type YahooInstrument = {
  name: string;
  url: string;
};

function unixSeconds(date: string) {
  return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000);
}

async function loadCloses(symbol: string, start?: string, end?: string) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  if (start && end) {
    url.searchParams.set("period1", String(unixSeconds(start)));
    url.searchParams.set("period2", String(unixSeconds(end)));
  } else {
    url.searchParams.set("range", "5d");
  }
  url.searchParams.set("interval", "1d");
  url.searchParams.set("events", "history");

  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) {
    throw new Error(`Yahoo Finance did not return data for ${symbol}.`);
  }

  const body = (await response.json()) as YahooChartResponse;
  const result = body.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];

  return timestamps.flatMap((timestamp, index) => {
    const close = closes[index];
    return typeof close === "number"
      ? [{ date: new Date(timestamp * 1000).toISOString().slice(0, 10), close }]
      : [];
  });
}

export async function getYahooPrice(symbol: string, date: string) {
  const end = new Date(`${date}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 8);
  const closes = await loadCloses(symbol, date, end.toISOString().slice(0, 10));
  const close = closes.find((entry) => entry.date >= date)?.close;

  if (close === undefined) {
    throw new Error(`Yahoo Finance has no price for ${symbol} on or after ${date}.`);
  }

  return close;
}

export async function getYahooLatestPrice(symbol: string) {
  const closes = await loadCloses(symbol);
  const close = closes.at(-1)?.close;

  if (close === undefined) {
    throw new Error(`Yahoo Finance has no latest price for ${symbol}.`);
  }

  return close;
}

export function getYahooInstrumentUrl(symbol: string) {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
}

export async function getYahooInstrument(symbol: string): Promise<YahooInstrument> {
  const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", symbol);
  url.searchParams.set("quotesCount", "1");
  url.searchParams.set("newsCount", "0");

  const response = await fetch(url, { next: { revalidate: 86_400 } });
  if (!response.ok) {
    throw new Error(`Yahoo Finance did not return instrument details for ${symbol}.`);
  }

  const body = (await response.json()) as YahooSearchResponse;
  const quote = body.quotes?.find((entry) => entry.symbol === symbol) ?? body.quotes?.[0];
  const name = quote?.longname ?? quote?.shortname;

  if (!name) {
    throw new Error(`Yahoo Finance has no instrument name for ${symbol}.`);
  }

  return { name, url: getYahooInstrumentUrl(symbol) };
}

export async function getYahooFxRate(fromCurrency: string, toCurrency: string, date: string) {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  return getYahooPrice(`${fromCurrency}${toCurrency}=X`, date);
}

export async function getYahooLatestFxRate(fromCurrency: string, toCurrency: string) {
  if (fromCurrency === toCurrency) {
    return 1;
  }

  return getYahooLatestPrice(`${fromCurrency}${toCurrency}=X`);
}
