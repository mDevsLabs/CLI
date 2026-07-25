import chalk from "chalk";

export const BANNER = `
${chalk.blue.bold("███╗   ███╗")}${chalk.red.bold("██████╗ ██╗")}${chalk.yellow.bold("     ██████╗██╗")}${chalk.green.bold("     ██╗")}
${chalk.blue.bold("████╗ ████║")}${chalk.red.bold("██╔══██╗██║")}${chalk.yellow.bold("    ██╔════╝██║")}${chalk.green.bold("     ██║")}
${chalk.blue.bold("██╔████╔██║")}${chalk.red.bold("███████║██║")}${chalk.yellow.bold("    ██║     ██║")}${chalk.green.bold("     ██║")}
${chalk.blue.bold("██║╚██╔╝██║")}${chalk.red.bold("██╔══██║██║")}${chalk.yellow.bold("    ██║     ██║")}${chalk.green.bold("     ██║")}
${chalk.blue.bold("██║ ╚═╝ ██║")}${chalk.red.bold("██║  ██║██║")}${chalk.yellow.bold("    ╚██████╗███████╗")}${chalk.green.bold("██║")}
${chalk.blue.bold("╚═╝     ╚═╝")}${chalk.red.bold("╚═╝  ╚═╝╚═╝")}${chalk.yellow.bold("     ╚═════╝╚══════╝")}${chalk.green.bold("╚═╝")}
  ${chalk.cyan.bold("mAI CLI")} - ${chalk.white("With mAI CLI, chat and code in your terminal !")}
`;

export const BANNER_COMPACT = chalk.cyan.bold(`mAI CLI`) + chalk.dim(` - With mAI CLI, chat and code in your terminal !`);

export function getBanner(width: number): string {
  return width >= 65 ? BANNER : BANNER_COMPACT;
}

export function getTerminalSize(): { columns: number; rows: number } {
  return {
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  };
}

export function onResize(callback: (size: { columns: number; rows: number }) => void): () => void {
  const handler = () => {
    callback(getTerminalSize());
  };
  process.stdout.on("resize", handler);
  return () => {
    process.stdout.off("resize", handler);
  };
}

export function truncateToWidth(text: string, maxWidth: number): string {
  if (text.length <= maxWidth) return text;
  return text.slice(0, maxWidth - 3) + "...";
}

export function wrapText(text: string, width: number): string {
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    if (line.length <= width) {
      lines.push(line);
    } else {
      let remaining = line;
      while (remaining.length > width) {
        let breakAt = remaining.lastIndexOf(" ", width);
        if (breakAt <= 0) breakAt = width;
        lines.push(remaining.slice(0, breakAt));
        remaining = remaining.slice(breakAt).trimStart();
      }
      if (remaining) lines.push(remaining);
    }
  }
  return lines.join("\n");
}

export function formatTokens(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return count.toString();
}
