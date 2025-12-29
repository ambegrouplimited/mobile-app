import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Theme } from "@/constants/theme";
import {
  PAYMENT_METHODS,
  PaymentMethodDef,
  PaymentVariant,
  paymentLogos,
} from "@/data/payment-methods";

export type PaymentMethodSelection = {
  method: PaymentMethodDef;
  variant: PaymentVariant;
  values: Record<string, string>;
  label: string;
};

type PaymentMethodComposerProps = {
  title: string;
  subtitle: string;
  backLabel: string;
  onBack: () => void;
  onSubmit: (selection: PaymentMethodSelection) => Promise<void> | void;
  primaryButtonLabel?:
    | string
    | ((selection: PaymentMethodSelection) => string);
  submitting?: boolean;
  methods?: PaymentMethodDef[];
  initialMethodId?: string;
  initialVariantId?: string;
  initialFormValues?: Record<string, Record<string, string>>;
  footerSlot?: ReactNode;
};

export function PaymentMethodComposer({
  title,
  subtitle,
  backLabel,
  onBack,
  onSubmit,
  primaryButtonLabel,
  submitting,
  methods = PAYMENT_METHODS,
  initialMethodId,
  initialFormValues,
  initialVariantId,
  footerSlot,
}: PaymentMethodComposerProps) {
  const orderedMethods = useMemo(() => {
    if (!initialMethodId) {
      return methods;
    }
    const targetIndex = methods.findIndex((method) => method.id === initialMethodId);
    if (targetIndex <= 0) {
      return methods;
    }
    const target = methods[targetIndex];
    return [target, ...methods.filter((_, index) => index !== targetIndex)];
  }, [initialMethodId, methods]);

  const fallbackMethod = orderedMethods[0];
  if (!fallbackMethod) {
    throw new Error("PaymentMethodComposer requires at least one method.");
  }
  const [selectedMethod, setSelectedMethod] = useState<string>(
    initialMethodId && orderedMethods.some((method) => method.id === initialMethodId)
      ? initialMethodId
      : fallbackMethod.id
  );
  const [variantSelections, setVariantSelections] = useState<Record<string, string>>(() => {
    if (initialMethodId && initialVariantId) {
      return { [initialMethodId]: initialVariantId };
    }
    return {};
  });
  const [formValues, setFormValues] = useState<
    Record<string, Record<string, string>>
  >(initialFormValues ?? {});

  useEffect(() => {
    if (initialMethodId && orderedMethods.some((method) => method.id === initialMethodId)) {
      setSelectedMethod(initialMethodId);
    }
  }, [initialMethodId, orderedMethods]);

  useEffect(() => {
    if (initialMethodId && initialVariantId) {
      setVariantSelections((prev) => ({
        ...prev,
        [initialMethodId]: initialVariantId,
      }));
    }
  }, [initialMethodId, initialVariantId]);

  useEffect(() => {
    if (initialFormValues) {
      setFormValues(initialFormValues);
    }
  }, [initialFormValues]);

  const currentMethod = useMemo(
    () =>
      orderedMethods.find((method) => method.id === selectedMethod) ?? orderedMethods[0],
    [orderedMethods, selectedMethod]
  );

  const currentVariant =
    currentMethod.variants.find(
      (variant) => variant.id === variantSelections[currentMethod.id]
    ) ?? currentMethod.variants[0];

  const formKey = `${currentMethod.id}:${currentVariant.id}`;
  const currentValues = formValues[formKey] ?? {};

  const selection: PaymentMethodSelection = {
    method: currentMethod,
    variant: currentVariant,
    values: currentValues,
    label: `${currentMethod.title} · ${currentVariant.label}`,
  };

  const requiredComplete = currentVariant.fields
    .filter((field) => field.required)
    .every((field) => Boolean(currentValues[field.key]?.trim()));

  const buttonLabel =
    typeof primaryButtonLabel === "function"
      ? primaryButtonLabel(selection)
      : primaryButtonLabel ?? `Use ${selection.label}`;

  const handleFieldUpdate = (key: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [formKey]: {
        ...(prev[formKey] ?? {}),
        [key]: value,
      },
    }));
  };

  const handleVariantChange = (methodId: string, variantId: string) => {
    setVariantSelections((prev) => ({ ...prev, [methodId]: variantId }));
  };

  const canSubmit = requiredComplete && !submitting;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable style={styles.backLink} onPress={onBack}>
          <Feather name="arrow-left" size={24} color={Theme.palette.ink} />
          <Text style={styles.backLabel}>{backLabel}</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        <View style={styles.optionColumn}>
          {orderedMethods.map((method) => {
            const active = method.id === currentMethod.id;
            const selectedVariantId =
              variantSelections[method.id] ?? method.variants[0].id;
            const activeVariant =
              method.variants.find(
                (variant) =>
                  variant.id ===
                  (active ? currentVariant.id : selectedVariantId)
              ) ?? method.variants[0];
            return (
              <Pressable
                key={method.id}
                onPress={() => setSelectedMethod(method.id)}
                style={[styles.optionCard, active && styles.optionCardActive]}
              >
                <View style={styles.optionHeader}>
                  <View style={styles.logoWrap}>
                    {method.id === "other" ? (
                      <Feather name="layers" size={24} color={Theme.palette.slate} />
                    ) : (
                      <Image
                        source={{ uri: paymentLogos[method.logo] }}
                        style={styles.logo}
                        contentFit="contain"
                      />
                    )}
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>{method.title}</Text>
                    <Text style={styles.optionSubtitle}>{method.subtitle}</Text>
                  </View>
                  {active ? (
                    <Feather
                      name="check-circle"
                      size={20}
                      color={Theme.palette.slate}
                    />
                  ) : null}
                </View>
                {active ? (
                  <>
                    {method.variants.length > 3 ? (
                      <View style={styles.variantGrid}>
                        {method.variants.map((variant) => {
                          const variantActive = variant.id === currentVariant.id;
                          return (
                            <Pressable
                              key={variant.id}
                              onPress={() => handleVariantChange(method.id, variant.id)}
                              style={[
                                styles.variantGridItem,
                                variantActive && styles.variantGridItemActive,
                              ]}
                            >
                              <View style={styles.variantGridContent}>
                                {variant.icon ? (
                                  <Image
                                    source={{ uri: paymentLogos[variant.icon] }}
                                    style={styles.variantIconLarge}
                                    contentFit="contain"
                                  />
                                ) : null}
                                <Text
                                  style={[
                                    styles.variantGridLabel,
                                    variantActive && styles.variantGridLabelActive,
                                  ]}
                                >
                                  {variant.label}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : method.variants.length > 1 ? (
                      <View style={styles.variantToggleRow}>
                        {method.variants.map((variant) => {
                          const variantActive =
                            variant.id === currentVariant.id;
                          return (
                            <Pressable
                              key={variant.id}
                              onPress={() =>
                                handleVariantChange(method.id, variant.id)
                              }
                              style={[
                                styles.variantToggleButton,
                                variantActive &&
                                  styles.variantToggleButtonActive,
                              ]}
                            >
                              <View style={styles.variantToggleContent}>
                                {variant.icon ? (
                                  <Image
                                    source={{ uri: paymentLogos[variant.icon] }}
                                    style={styles.variantIcon}
                                    contentFit="contain"
                                  />
                                ) : null}
                                <Text
                                  style={[
                                    styles.variantToggleLabel,
                                    variantActive &&
                                      styles.variantToggleLabelActive,
                                  ]}
                                >
                                  {variant.label}
                                </Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                    <View style={styles.fieldColumn}>
                      {currentVariant.fields.map((field) => (
                        <View
                          key={`${currentMethod.id}-${currentVariant.id}-${field.key}`}
                          style={styles.fieldGroup}
                        >
                          <Text style={styles.fieldLabel}>{field.label}</Text>
                          <TextInput
                            style={[
                              styles.input,
                              field.multiline && styles.inputMultiline,
                            ]}
                            placeholder={field.placeholder}
                            placeholderTextColor={Theme.palette.slateSoft}
                            value={currentValues[field.key] ?? ""}
                            onChangeText={(text) =>
                              handleFieldUpdate(field.key, text)
                            }
                            multiline={field.multiline}
                            autoCapitalize="none"
                          />
                          {field.helper ? (
                            <Text style={styles.helper}>{field.helper}</Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                    {currentVariant.note ? (
                      <Text style={styles.note}>{currentVariant.note}</Text>
                    ) : null}
                  </>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[
            styles.primaryButton,
            (!requiredComplete || submitting) && styles.primaryButtonDisabled,
          ]}
          disabled={!canSubmit}
          onPress={() => onSubmit(selection)}
        >
          <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
        </Pressable>
        {footerSlot ? <View style={styles.footerSlot}>{footerSlot}</View> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export default PaymentMethodComposer;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Theme.palette.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  backLabel: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  header: {
    gap: Theme.spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  subtitle: {
    fontSize: 15,
    color: Theme.palette.inkMuted,
    lineHeight: 22,
  },
  optionColumn: {
    gap: Theme.spacing.md,
  },
  optionCard: {
    borderRadius: Theme.radii.lg,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    padding: Theme.spacing.lg,
    backgroundColor: "#FFFFFF",
    gap: Theme.spacing.md,
  },
  optionCardActive: {
    borderColor: Theme.palette.slate,
    backgroundColor: "rgba(77, 94, 114, 0.08)",
  },
  optionHeader: {
    flexDirection: "row",
    gap: Theme.spacing.md,
    alignItems: "center",
  },
  logoWrap: {
    width: 48,
    height: 48,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.palette.surface,
  },
  logo: {
    width: 36,
    height: 36,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Theme.palette.ink,
  },
  optionSubtitle: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  fieldColumn: {
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  fieldGroup: {
    gap: Theme.spacing.xs,
  },
  fieldLabel: {
    fontSize: 13,
    color: Theme.palette.ink,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  variantToggleRow: {
    flexDirection: "row",
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    overflow: "hidden",
    marginTop: Theme.spacing.sm,
  },
  variantToggleButton: {
    flex: 1,
    paddingVertical: Theme.spacing.sm,
    alignItems: "center",
    backgroundColor: Theme.palette.surface,
  },
  variantToggleButtonActive: {
    backgroundColor: Theme.palette.slate,
  },
  variantToggleLabel: {
    fontSize: 14,
    color: Theme.palette.slate,
  },
  variantToggleLabelActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  variantToggleContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  variantIcon: {
    width: 18,
    height: 18,
  },
  variantGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.sm,
  },
  variantGridItem: {
    width: "30%",
    minWidth: 96,
    borderRadius: Theme.radii.md,
    borderWidth: 1,
    borderColor: Theme.palette.border,
    paddingVertical: Theme.spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Theme.palette.surface,
  },
  variantGridItemActive: {
    borderColor: Theme.palette.slate,
    backgroundColor: "rgba(77, 94, 114, 0.08)",
  },
  variantGridContent: {
    alignItems: "center",
    gap: Theme.spacing.xs,
  },
  variantIconLarge: {
    width: 28,
    height: 28,
  },
  variantGridLabel: {
    fontSize: 13,
    color: Theme.palette.slate,
  },
  variantGridLabelActive: {
    color: Theme.palette.ink,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: Theme.palette.border,
    borderRadius: Theme.radii.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    fontSize: 15,
    color: Theme.palette.ink,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  helper: {
    fontSize: 12,
    color: Theme.palette.slateSoft,
  },
  note: {
    fontSize: 13,
    color: Theme.palette.slate,
    lineHeight: 20,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Theme.spacing.md,
    borderRadius: Theme.radii.md,
    backgroundColor: Theme.palette.slate,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  footerSlot: {
    gap: Theme.spacing.sm,
  },
});
