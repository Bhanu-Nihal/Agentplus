import { ActionIcon, Group, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';

export default function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('dark');
  const isDark = computedColorScheme === 'dark';
  const isLight = computedColorScheme === 'light';

  return (
    <Group justify="center">
      <ActionIcon
        onClick={() => setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark')}
        variant="default"
        size="xl"
        aria-label="Toggle color scheme"
      >
        {isLight ? <IconMoon stroke={1.5} /> : <IconSun stroke={1.5} />}
      </ActionIcon>
    </Group>
  );
}
