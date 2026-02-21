import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import NotFound from '@/pages/NotFound';

describe('Components', () => {
  describe('NotFound', () => {
    it('should render 404 page', () => {
      render(
        <BrowserRouter>
          <NotFound />
        </BrowserRouter>
      );

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeDefined();
    });

    it('should have a return home link', () => {
      render(
        <BrowserRouter>
          <NotFound />
        </BrowserRouter>
      );

      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThan(0);
    });

    it('should display 404 error message', () => {
      render(
        <BrowserRouter>
          <NotFound />
        </BrowserRouter>
      );

      const text = screen.getByText(/404|not found/i);
      expect(text).toBeDefined();
    });
  });
});
