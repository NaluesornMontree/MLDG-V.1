jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn(() => jest.fn()),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signOut: jest.fn(() => Promise.resolve())
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  doc: jest.fn(),
  getDoc: jest.fn()
}));

jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({}))
}));

import { render, screen } from '@testing-library/react';
import App from './App';

test('renders application loading state', () => {
  render(<App />);
  expect(screen.getByText(/muang loei drive golf is loading/i)).toBeInTheDocument();
});
