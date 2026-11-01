import type { Contact, CreateRequestInput, MoneyRequest, RequestEvent, RequestStatus } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
export const isDemoMode = !API_BASE_URL

const now = new Date()
const iso = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60000).toISOString()

export const contacts: Contact[] = [
  { id: 'contact-1', name: 'Meera Nair', relationship: 'Sister', label: 'Family', enrolledAt: '2025-02-14', status: 'Enrolled' },
  { id: 'contact-2', name: 'Arjun Menon', relationship: 'Brother', label: 'Family', enrolledAt: '2025-03-02', status: 'Enrolled' },
  { id: 'contact-3', name: 'Kavita Shah', relationship: 'Financial adviser', label: 'Adviser', enrolledAt: '2025-04-19', status: 'Enrolled' },
]

let demoRequests: MoneyRequest[] = [
  {
    id: 'SS-2025-0041', amount: 25000, payee: 'Rohan Desai', purpose: 'Emergency medical expenses',
    requester: 'Ananya Iyer', trustedContactId: 'contact-1', status: 'PENDING',
    createdAt: iso(42), expiresAt: new Date(now.getTime() + 6 * 3600000).toISOString(), updatedAt: iso(42), version: 1,
    events: [{ id: 'e-1', type: 'created', description: 'Request created and sent for review', timestamp: iso(42), actor: 'Ananya Iyer' }],
  },
  {
    id: 'SS-2025-0040', amount: 8200, payee: 'Bengaluru Water Board', purpose: 'Quarterly water bill',
    requester: 'Ananya Iyer', trustedContactId: 'contact-2', status: 'APPROVED',
    createdAt: iso(160), expiresAt: new Date(now.getTime() + 2 * 3600000).toISOString(), updatedAt: iso(138), version: 1,
    events: [
      { id: 'e-2', type: 'approved', description: 'Details reviewed and approved by trusted contact', timestamp: iso(138), actor: 'Arjun Menon' },
      { id: 'e-3', type: 'created', description: 'Request created and sent for review', timestamp: iso(160), actor: 'Ananya Iyer' },
    ],
  },
  {
    id: 'SS-2025-0039', amount: 50000, payee: 'Vikram Iyer', purpose: 'Property deposit',
    requester: 'Ananya Iyer', trustedContactId: 'contact-3', status: 'INVALIDATED',
    createdAt: iso(1440), expiresAt: new Date(now.getTime() + 3600000).toISOString(), updatedAt: iso(25), version: 2,
    events: [
      { id: 'e-4', type: 'invalidated', description: 'Request details changed. Previous approval is no longer valid.', timestamp: iso(25), actor: 'Ananya Iyer' },
      { id: 'e-5', type: 'approved', description: 'Details reviewed and approved by trusted contact', timestamp: iso(1200), actor: 'Kavita Shah' },
      { id: 'e-6', type: 'created', description: 'Request created and sent for review', timestamp: iso(1440), actor: 'Ananya Iyer' },
    ],
  },
  {
    id: 'SS-2025-0038', amount: 1450, payee: 'Suresh Pharmacy', purpose: 'Prescription refill',
    requester: 'Ananya Iyer', trustedContactId: 'contact-1', status: 'DENIED',
    createdAt: iso(2880), expiresAt: new Date(now.getTime() - 1800000).toISOString(), updatedAt: iso(2800), version: 1,
    events: [{ id: 'e-7', type: 'denied', description: 'Request denied by trusted contact', timestamp: iso(2800), actor: 'Meera Nair' }],
  },
]

const wait = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms))
const demoOrFetch = async <T>(demo: () => T, path: string, init?: RequestInit): Promise<T> => {
  if (isDemoMode) { await wait(); return demo() }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  if (!response.ok) throw new Error(response.status === 403 ? 'You are not authorised for this action.' : response.status === 409 ? 'This request changed on the server. Refresh and review the latest details.' : `Request failed (${response.status}).`)
  return response.json() as Promise<T>
}

export const api = {
  listRequests: () => demoOrFetch(() => [...demoRequests], '/api/requests'),
  getRequest: (id: string) => demoOrFetch(() => demoRequests.find((request) => request.id === id) as MoneyRequest, `/api/requests/${id}`),
  listContacts: () => demoOrFetch(() => contacts, '/api/contacts'),
  createRequest: (input: CreateRequestInput) => demoOrFetch(() => {
    const request: MoneyRequest = {
      ...input, id: `SS-2025-${String(42 + demoRequests.length).padStart(4, '0')}`, requester: 'Ananya Iyer', status: 'PENDING',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1,
      events: [{ id: crypto.randomUUID(), type: 'created', description: 'Request created and sent for review', timestamp: new Date().toISOString(), actor: 'Ananya Iyer' }],
    }
    demoRequests = [request, ...demoRequests]
    return request
  }, '/api/requests', { method: 'POST', body: JSON.stringify(input) }),
  decide: (id: string, decision: 'approve' | 'deny', version: number) => demoOrFetch(() => {
    const request = demoRequests.find((item) => item.id === id)
    if (!request || request.version !== version) throw new Error('This request changed on the server. Refresh and review the latest details.')
    request.status = decision === 'approve' ? 'APPROVED' : 'DENIED'
    request.updatedAt = new Date().toISOString()
    request.events.unshift({ id: crypto.randomUUID(), type: decision === 'approve' ? 'approved' : 'denied', description: decision === 'approve' ? 'Details reviewed and approved by trusted contact' : 'Request denied by trusted contact', timestamp: request.updatedAt, actor: 'Meera Nair' })
    return request
  }, `/api/requests/${id}/${decision}`, { method: 'POST', body: JSON.stringify({ version }) }),
  updateRequest: (id: string, input: Partial<CreateRequestInput>, version: number) => demoOrFetch(() => {
    const request = demoRequests.find((item) => item.id === id)
    if (!request || request.version !== version) throw new Error('This request changed on the server. Refresh and try again.')
    Object.assign(request, input, { version: request.version + 1, status: 'INVALIDATED' as RequestStatus, updatedAt: new Date().toISOString() })
    request.events.unshift({ id: crypto.randomUUID(), type: 'invalidated', description: 'Request details changed. Previous approval is no longer valid.', timestamp: request.updatedAt, actor: 'Ananya Iyer' })
    return request
  }, `/api/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ ...input, version }) }),
}

export const formatINR = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
export const formatDate = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
export const formatDateTime = (value: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
