import type {
  ApprovalReceipt,
} from './approvalReceiptTypes.js';

export function renderApprovalReceipt(
  receipt: ApprovalReceipt,
): string {
  const output: string[] = [
    'THE CLOCK — APPROVAL RECEIPT',
    '============================',
    '',
    `Receipt ID: ${receipt.receiptId}`,
    `Verificado: ${receipt.verifiedAt}`,
    `Estado: ${receipt.status}`,
    '',
    `Servidor: ${receipt.guild.name}`,
    `Guild ID: ${receipt.guild.id}`,
    '',
    'PLAN AUTORIZADO',
    '---------------',
    `Content fingerprint: ${receipt.gateFingerprint}`,
    `Envelope fingerprint: ${receipt.gateEnvelopeFingerprint}`,
    `Método de aprobación: ${receipt.approvalBoundary.method}`,
    `Terminal interactiva: ${
      receipt.approvalBoundary.inputIsTTY &&
      receipt.approvalBoundary.outputIsTTY
        ? 'SÍ'
        : 'NO'
    }`,
    `Confirmation ID no reutilizado: ${
      receipt.approvalBoundary.confirmationUnused
        ? 'SÍ'
        : 'NO'
    }`,
    `Confirmation ID: ${receipt.manifest.confirmationId ?? '(ninguno)'}`,
    `Manifest creado: ${receipt.manifest.createdAt}`,
    `Manifest expira: ${receipt.manifest.expiresAt}`,
    '',
    'COMPROBACIONES',
    '--------------',
  ];

  for (
    const check
    of receipt.checks
  ) {
    output.push(
      `[${check.status.toUpperCase()}] ${check.id}`,
    );

    output.push(
      `  ${check.details}`,
    );
  }

  output.push(
    '',
    'RESUMEN',
    '-------',
    `PASS: ${receipt.summary.pass}`,
    `BLOCK: ${receipt.summary.block}`,
    '',
    `Aprobación válida: ${
      receipt.summary.approvalValid
        ? 'SÍ'
        : 'NO'
    }`,
    '',
    'EJECUCIÓN PERMITIDA: NO',
    '',
    'Este Receipt demuestra que una frase válida pasó la frontera interactiva configurada.',
    'El confirmationId solamente puede producir una aprobación local una vez.',
    'No contiene la frase introducida.',
    'No ejecuta ni modifica Discord.',
    '',
  );

  return output.join('\n');
}
