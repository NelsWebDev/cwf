import { deepMerge, MantineColorScheme, Select, SelectProps, useMantineColorScheme } from "@mantine/core";
import { IconChevronDown, IconPaletteFilled } from "@tabler/icons-react";




const ThemeSelector = (props?: Omit<SelectProps, "data" | "onChange" | "value" | "onChange">) => {   
      const { colorScheme, setColorScheme } = useMantineColorScheme();
      const styles : SelectProps['styles'] = deepMerge({root: { width: "120px", }, section: { color: "white" }, input: { background: 'transparent', border: "none", color: "var(--mantine-color-white)", fontWeight: "bold" } }, props?.styles);
      const {styles: newStyles, ...rest} = props || {};
    return (
        <Select
                leftSection={<IconPaletteFilled size={16} />}
                rightSection={<IconChevronDown size={16} color="white"/>}
                data={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
                value={colorScheme}
                searchValue="Theme"
                onChange={(value) => value && setColorScheme(value as MantineColorScheme)}
                styles={styles}
                {...rest}
              />
    )
}
export default ThemeSelector;