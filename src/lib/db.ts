import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
})

type Row = Record<string, unknown>

class QueryBuilder {
  private table: string
  private schema: string
  private conditions: string[] = []
  private values: unknown[] = []
  private selectCols = "*"
  private orderByClause = ""
  private limitClause = ""
  private isSingle = false

  constructor(table: string, schema = "fleethub") {
    this.table = table
    this.schema = schema
  }

  select(cols: string) {
    this.selectCols = cols
    return this
  }

  eq(col: string, val: unknown) {
    this.values.push(val)
    this.conditions.push(`"${col}" = $${this.values.length}`)
    return this
  }

  neq(col: string, val: unknown) {
    this.values.push(val)
    this.conditions.push(`"${col}" != $${this.values.length}`)
    return this
  }

  is(col: string, val: unknown) {
    if (val === null) {
      this.conditions.push(`"${col}" IS NULL`)
    } else {
      this.values.push(val)
      this.conditions.push(`"${col}" IS $${this.values.length}`)
    }
    return this
  }

  not(col: string, op: string, val: unknown) {
    if (op === "is" && val === null) {
      this.conditions.push(`"${col}" IS NOT NULL`)
    } else {
      this.values.push(val)
      this.conditions.push(`NOT "${col}" = $${this.values.length}`)
    }
    return this
  }

  in(col: string, vals: unknown[]) {
    const placeholders = vals.map((v, i) => {
      this.values.push(v)
      return `$${this.values.length}`
    })
    this.conditions.push(`"${col}" IN (${placeholders.join(", ")})`)
    return this
  }

  order(col: string, opts?: { ascending?: boolean }) {
    const dir = opts?.ascending === false ? "DESC" : "ASC"
    this.orderByClause = `ORDER BY "${col}" ${dir}`
    return this
  }

  limit(n: number) {
    this.limitClause = `LIMIT ${n}`
    return this
  }

  single() {
    this.isSingle = true
    return this
  }

  async execute(): Promise<{ data: unknown; error: unknown }> {
    try {
      const where = this.conditions.length
        ? `WHERE ${this.conditions.join(" AND ")}`
        : ""
      const sql = `SELECT ${this.selectCols} FROM ${this.schema}."${this.table}" ${where} ${this.orderByClause} ${this.limitClause}`.trim()
      const result = await pool.query(sql, this.values)
      if (this.isSingle) {
        return { data: result.rows[0] ?? null, error: null }
      }
      return { data: result.rows, error: null }
    } catch (err) {
      return { data: null, error: err }
    }
  }

  then(resolve: (val: { data: unknown; error: unknown }) => void, reject?: (err: unknown) => void) {
    return this.execute().then(resolve, reject)
  }
}

class InsertBuilder {
  private table: string
  private schema: string
  private row: Row
  private isSingle = false

  constructor(table: string, row: Row, schema = "fleethub") {
    this.table = table
    this.row = row
    this.schema = schema
  }

  select() { return this }
  single() { this.isSingle = true; return this }

  async execute(): Promise<{ data: unknown; error: unknown }> {
    try {
      const keys = Object.keys(this.row)
      const cols = keys.map((k) => `"${k}"`).join(", ")
      const vals = keys.map((k) => this.row[k])
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ")
      const sql = `INSERT INTO ${this.schema}."${this.table}" (${cols}) VALUES (${placeholders}) RETURNING *`
      const result = await pool.query(sql, vals)
      return { data: this.isSingle ? result.rows[0] : result.rows, error: null }
    } catch (err) {
      return { data: null, error: err }
    }
  }

  then(resolve: (val: { data: unknown; error: unknown }) => void, reject?: (err: unknown) => void) {
    return this.execute().then(resolve, reject)
  }
}

class UpdateBuilder {
  private table: string
  private schema: string
  private updates: Row
  private conditions: string[] = []
  private values: unknown[] = []

  constructor(table: string, updates: Row, schema = "fleethub") {
    this.table = table
    this.updates = updates
    this.schema = schema
  }

  eq(col: string, val: unknown) {
    this.values.push(val)
    this.conditions.push(`"${col}" = $${this.values.length}`)
    return this
  }

  select() { return this }

  async execute(): Promise<{ data: unknown; error: unknown }> {
    try {
      const updateKeys = Object.keys(this.updates)
      const updateVals = updateKeys.map((k) => this.updates[k])
      const setClauses = updateKeys.map((k, i) => `"${k}" = $${i + 1}`)
      const allVals = [...updateVals, ...this.values]
      const whereClauses = this.conditions.map((c, i) =>
        c.replace(/\$(\d+)/g, (_, n) => `$${Number(n) + updateKeys.length}`)
      )
      const sql = `UPDATE ${this.schema}."${this.table}" SET ${setClauses.join(", ")} WHERE ${whereClauses.join(" AND ")} RETURNING *`
      const result = await pool.query(sql, allVals)
      return { data: result.rows, error: null }
    } catch (err) {
      return { data: null, error: err }
    }
  }

  then(resolve: (val: { data: unknown; error: unknown }) => void, reject?: (err: unknown) => void) {
    return this.execute().then(resolve, reject)
  }
}

class DeleteBuilder {
  private table: string
  private schema: string
  private conditions: string[] = []
  private values: unknown[] = []

  constructor(table: string, schema = "fleethub") {
    this.table = table
    this.schema = schema
  }

  eq(col: string, val: unknown) {
    this.values.push(val)
    this.conditions.push(`"${col}" = $${this.values.length}`)
    return this
  }

  async execute(): Promise<{ data: unknown; error: unknown }> {
    try {
      const where = this.conditions.length
        ? `WHERE ${this.conditions.join(" AND ")}`
        : ""
      const sql = `DELETE FROM ${this.schema}."${this.table}" ${where} RETURNING *`
      const result = await pool.query(sql, this.values)
      return { data: result.rows, error: null }
    } catch (err) {
      return { data: null, error: err }
    }
  }

  then(resolve: (val: { data: unknown; error: unknown }) => void, reject?: (err: unknown) => void) {
    return this.execute().then(resolve, reject)
  }
}

export const db = {
  from(table: string) {
    return {
      select(cols = "*") {
        return new QueryBuilder(table).select(cols)
      },
      insert(row: Row) {
        return new InsertBuilder(table, row)
      },
      update(updates: Row) {
        return new UpdateBuilder(table, updates)
      },
      delete() {
        return new DeleteBuilder(table)
      },
    }
  },
  query: pool.query.bind(pool),
}
