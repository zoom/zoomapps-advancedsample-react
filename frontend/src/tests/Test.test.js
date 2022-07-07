import { render, screen } from '@testing-library/react';
import Test from '../components/Test';

test('renders a test component', () => {
  render(<Test />);
  const linkElement = screen.getByText(/Hello Test/i);
  expect(linkElement).toBeInTheDocument();
});
