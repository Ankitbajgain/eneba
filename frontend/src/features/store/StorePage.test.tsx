import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StorePage } from './StorePage'
import { read } from '../../lib/marketplace'

vi.mock('../../lib/marketplace', async importOriginal => ({ ...await importOriginal<typeof import('../../lib/marketplace')>(), read: vi.fn() }))
afterEach(() => vi.resetAllMocks())
function Location() { const location = useLocation(); const navigate = useNavigate(); return <><output aria-label="URL">{location.search}</output><button onClick={() => navigate(-1)}>Back</button></> }
function setup() {
  vi.mocked(read).mockImplementation(async path => (path === '/catalog/filters' ? { data: { platforms: [{ code: 'steam', name: 'Steam' }, { code: 'xbox', name: 'Xbox Live' }], regions: [{ code: 'global', name: 'Global' }] } } : { data: [], meta: { page: 1, per_page: 24, total: 0, last_page: 1 } }) as never)
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/store?page=2']}><StorePage /><Location /></MemoryRouter></QueryClientProvider>)
}
describe('catalog URL state', () => {
  it('resets pagination when filters change and restores sorting with browser history', async () => {
    setup()
    await waitFor(() => expect(read).toHaveBeenCalledWith(expect.stringContaining('per_page=12'), expect.anything()))
    fireEvent.click(await screen.findByRole('radio', { name: 'Steam' }))
    await waitFor(() => expect(screen.getByLabelText('URL')).toHaveTextContent('?platform=steam'))
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort products' }), { target: { value: 'price_asc' } })
    expect(screen.getByLabelText('URL')).toHaveTextContent('sort=price_asc')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Sort products' })).toHaveValue('newest'))
    expect(screen.getByRole('radio', { name: 'Steam' })).toBeChecked()
  })
  it('sends inclusive euro price bounds as integer cents in the URL', async () => {
    setup()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Minimum price in euros' }), { target: { value: '14.99' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Maximum price in euros' }), { target: { value: '29.99' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply price' }))
    expect(screen.getByLabelText('URL')).toHaveTextContent('min_price=1499')
    expect(screen.getByLabelText('URL')).toHaveTextContent('max_price=2999')
    expect(screen.getByLabelText('URL')).not.toHaveTextContent('page=')
  })
})
