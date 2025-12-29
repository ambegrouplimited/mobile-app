import { Pressable, StyleSheet, Text, View } from "react-native";

import { Theme } from "@/constants/theme";

type ToggleOption = {
  label: string;
  value: string;
};

type ToggleGroupProps = {
  value: string;
  onChange: (value: string) => void;
  options: ToggleOption[];
};

export function ToggleGroup({ value, onChange, options }: ToggleGroupProps) {
  return (
    <View style={styles.pill}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.button, active && styles.buttonActive]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.buttonLabel, active && styles.buttonLabelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    overflow: "hidden",
  },
  button: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    alignItems: "center",
    backgroundColor: Theme.palette.surface,
  },
  buttonActive: {
    backgroundColor: Theme.palette.slate,
  },
  buttonLabel: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  buttonLabelActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
