import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { CheckoutPage } from './CheckoutPage'
import { write } from '../../lib/marketplace'

const navigate = vi.hoisted(() => vi.fn())
const cartState = vi.hoisted(() => ({ empty: false }))
vi.mock('react-router-dom', async importOriginal => ({ ...await importOriginal<typeof import('react-router-dom')>(), useNavigate: () => navigate }))
vi.mock('../../lib/marketplace', async importOriginal => ({ ...await importOriginal<typeof import('../../lib/marketplace')>(), write: vi.fn() }))
vi.mock('../../app/providers', () => ({ useSession: () => ({ user: { id: 1, name: 'Buyer', email: 'buyer@example.test' }, loading: false }), useCart: () => ({ loading: false, merging: false, cart: { data: { revision: 2, items: cartState.empty ? [] : [{ id: 1, quantity: 1, valid: true, product: { title: 'Test game' }, offer: { price: { amount_minor: 1000, currency: 'EUR' } } }], total: { amount_minor: 1000, currency: 'EUR' } } } }) }))
afterEach(() => { vi.resetAllMocks(); cartState.empty = false })
it('retains the same idempotency key when the user retries an uncertain network outcome', async () => {
  vi.mocked(write).mockRejectedValueOnce(new TypeError('Network failure')).mockResolvedValueOnce({ data: { id: 'order-id' } })
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><CheckoutPage /></MemoryRouter></QueryClientProvider>)
  fireEvent.click(screen.getByRole('button', { name: /^Pay/ }))
  await screen.findByRole('alert')
  expect(write).toHaveBeenCalledTimes(1)
  const first = vi.mocked(write).mock.calls[0][3]?.['Idempotency-Key']
  fireEvent.click(screen.getByRole('button', { name: /^Pay/ }))
  await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/orders/order-id'))
  expect(vi.mocked(write).mock.calls[1][3]?.['Idempotency-Key']).toBe(first)
  expect(first).toMatch(/^[a-f0-9-]{36}$/)
})

it('can recover a committed checkout after its response was lost and the cart became empty', async () => {
  vi.mocked(write).mockRejectedValueOnce(new TypeError('Lost response')).mockResolvedValueOnce({ data: { id: 'recovered-order' } })
  const client = new QueryClient()
  const tree = () => <QueryClientProvider client={client}><MemoryRouter><CheckoutPage /></MemoryRouter></QueryClientProvider>
  const view = render(tree())
  fireEvent.click(screen.getByRole('button', { name: /^Pay/ }))
  await screen.findByRole('alert')
  const original = vi.mocked(write).mock.calls[0]
  cartState.empty = true; view.rerender(tree())
  fireEvent.click(screen.getByRole('button', { name: 'Recover previous checkout' }))
  await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/orders/recovered-order'))
  expect(vi.mocked(write).mock.calls[1][1]).toEqual(original[1])
  expect(vi.mocked(write).mock.calls[1][3]).toEqual(original[3])
})
