import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { Theme } from "@/constants/theme";

import QRCodeImpl from "qrcode-terminal/vendor/QRCode";
import QRErrorCorrectLevel from "qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel";

type Props = {
  value: string;
  size?: number;
  color?: string;
  backgroundColor?: string;
};

type Matrix = boolean[][];

function generateMatrix(value: string): Matrix {
  const qr = new QRCodeImpl(-1, QRErrorCorrectLevel.M);
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  const cells: Matrix = [];
  for (let row = 0; row < count; row += 1) {
    cells[row] = [];
    for (let col = 0; col < count; col += 1) {
      cells[row][col] = qr.isDark(row, col);
    }
  }
  return cells;
}

function QrCodeInner({
  value,
  size = 200,
  color = Theme.palette.ink,
  backgroundColor = "#FFFFFF",
}: Props) {
  const matrix = useMemo(() => generateMatrix(value), [value]);
  const moduleCount = matrix.length;
  const cellSize = size / moduleCount;
  return (
    <View style={[styles.container, { width: size, height: size, backgroundColor }]}>
      <Svg width={size} height={size}>
        {matrix.map((row, rowIndex) =>
          row.map((isDark, colIndex) => {
            if (!isDark) return null;
            const x = colIndex * cellSize;
            const y = rowIndex * cellSize;
            return (
              <Rect
                key={`${rowIndex}-${colIndex}`}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                fill={color}
              />
            );
          })
        )}
      </Svg>
    </View>
  );
}

export const QrCode = memo(QrCodeInner);

const styles = StyleSheet.create({
  container: {
    borderRadius: Theme.radii.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: Theme.palette.border,
  },
});
