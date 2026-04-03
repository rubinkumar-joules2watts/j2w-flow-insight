type QueryResult<T> = Promise<{ data: T; error: null } | { data: null; error: Error }>;

class SelectBuilder<T = any> {
  private table: string;
  private orderBy?: string;
  private ascending = true;

  constructor(table: string) {
    this.table = table;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = column;
    this.ascending = opts?.ascending ?? true;
    return this;
  }

  async then(resolve: (value: any) => any, reject?: (reason: any) => any) {
    try {
      const params = new URLSearchParams();
      if (this.orderBy) {
        params.set("orderBy", this.orderBy);
        params.set("ascending", String(this.ascending));
      }
      const url = params.toString() ? `/api/${this.table}?${params}` : `/api/${this.table}`;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Failed to fetch ${this.table}`);
      resolve({ data: json as T, error: null });
    } catch (e) {
      resolve({ data: null, error: e as Error });
    }
    return undefined;
  }
}

class InsertBuilder<T = any> {
  private table: string;
  private payload: any;

  constructor(table: string, payload: any) {
    this.table = table;
    this.payload = payload;
  }

  select() {
    return this;
  }

  async single(): QueryResult<T> {
    try {
      const res = await fetch(`/api/${this.table}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Failed to insert into ${this.table}`);
      return { data: json as T, error: null };
    } catch (e) {
      return { data: null, error: e as Error };
    }
  }

  async then(resolve: (value: any) => any) {
    try {
      const res = await fetch(`/api/${this.table}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Failed to insert into ${this.table}`);
      resolve({ data: json as T, error: null });
    } catch (e) {
      resolve({ data: null, error: e as Error });
    }
    return undefined;
  }
}

class UpdateDeleteBuilder<T = any> {
  private table: string;
  private method: "PATCH" | "DELETE";
  private payload?: any;

  constructor(table: string, method: "PATCH" | "DELETE", payload?: any) {
    this.table = table;
    this.method = method;
    this.payload = payload;
  }

  async eq(column: string, value: string): QueryResult<T> {
    if (column !== "id") {
      return { data: null, error: new Error("Only eq('id', value) is supported") };
    }

    try {
      const res = await fetch(`/api/${this.table}/${value}`, {
        method: this.method,
        headers: { "Content-Type": "application/json" },
        body: this.method === "PATCH" ? JSON.stringify(this.payload || {}) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Failed to ${this.method} ${this.table}`);
      return { data: json as T, error: null };
    } catch (e) {
      return { data: null, error: e as Error };
    }
  }
}

const from = <T = any>(table: string) => ({
  select: (_cols: string = "*") => new SelectBuilder<T>(table),
  insert: (payload: any) => new InsertBuilder<T>(table, payload),
  update: (payload: any) => new UpdateDeleteBuilder<T>(table, "PATCH", payload),
  delete: () => new UpdateDeleteBuilder<T>(table, "DELETE"),
});

export const supabase = {
  from,
  channel: () => {
    const mockChannel = {
      on: () => mockChannel,
      subscribe: () => mockChannel,
    };
    return mockChannel;
  },
  removeChannel: () => undefined,
};
