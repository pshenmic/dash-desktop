export interface ListWindow<T> {
  items: T[]
  hasMore: boolean
  remaining: number
}

export interface ListGroup<T> {
  key: string
  label: string | null
  items: T[]
  total: number
}

export interface GroupWindow<T> {
  groups: ListGroup<T>[]
  hasMore: boolean
  remaining: number
}

export interface DayGroup<T> {
  key: string
  date: Date
  items: T[]
}

export interface DayGroupWindow<T> {
  groups: DayGroup<T>[]
  hasMore: boolean
  remaining: number
}
