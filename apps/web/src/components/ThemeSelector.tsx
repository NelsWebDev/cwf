import { deepMerge, MantineColorScheme, Select, SelectProps, useMantineColorScheme } from "@mantine/core";
import { IconChevronDown, IconPaletteFilled } from "@tabler/icons-react";
import { useContext } from "react";
import { ThemeOptionContext } from "../providers/Contexts";




const ThemeSelector = (props?: Omit<SelectProps, "data" | "onChange" | "value">) => {
      const { setColorScheme } = useMantineColorScheme();
      const themeContext = useContext(ThemeOptionContext);
      if (!themeContext) {
        throw new Error("ThemeSelector must be used within ThemeOptionContext");
      }
      const { themeOption, setThemeOption } = themeContext;
      const { styles: propStyles, ...rest } = props || {};
      const styles : SelectProps['styles'] = deepMerge({root: { width: "120px", }, section: { color: "white" }, input: { background: 'transparent', border: "none", color: "var(--mantine-color-white)", fontWeight: "bold" } }, propStyles);
    return (
        <Select
                leftSection={<IconPaletteFilled size={16} />}
                rightSection={<IconChevronDown size={16} color="white"/>}
                data={[
                  { value: 'auto', label: 'Auto' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                  { value: 'purple', label: 'Purple' },
                ]}
                value={themeOption}
                searchValue="Theme"
                onChange={(value) => {
                  if (value === "auto" || value === "light" || value === "dark") {
                    setThemeOption(value);
                    setColorScheme(value as MantineColorScheme);
                  } else if (value === "purple") {
                    setThemeOption(value);
                    setColorScheme("dark");
                  }
                }}
                styles={styles}
                {...rest}
              />
    )
}
export default ThemeSelector;