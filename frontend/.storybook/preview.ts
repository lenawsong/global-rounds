import type { Preview } from '@storybook/react';
import '../packages/ui/src/styles/storybook.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/
      }
    }
  }
};

export default preview;

