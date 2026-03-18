import { z } from 'zod';

// Auth validation schemas
export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Email inválido" })
    .max(255, { message: "Email deve ter menos de 255 caracteres" })
    .refine((email) => email.endsWith('@lasalle.org.br'), {
      message: "Apenas emails @lasalle.org.br são permitidos"
    }),
  password: z
    .string()
    .min(8, { message: "Senha deve ter pelo menos 8 caracteres" })
    .max(128, { message: "Senha deve ter menos de 128 caracteres" })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
      message: "Senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número"
    })
});

export const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Email inválido" })
    .max(255, { message: "Email deve ter menos de 255 caracteres" })
    .refine((email) => email.endsWith('@lasalle.org.br'), {
      message: "Apenas emails @lasalle.org.br são permitidos"
    }),
  password: z
    .string()
    .min(8, { message: "Senha deve ter pelo menos 8 caracteres" })
    .max(128, { message: "Senha deve ter menos de 128 caracteres" })
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/, {
      message: "Senha deve conter pelo menos uma letra minúscula, uma maiúscula, um número e um caractere especial"
    }),
  confirmPassword: z
    .string()
    .min(8, { message: "Confirmação de senha deve ter pelo menos 8 caracteres" }),
  fullName: z
    .string()
    .trim()
    .min(2, { message: "Nome deve ter pelo menos 2 caracteres" })
    .max(100, { message: "Nome deve ter menos de 100 caracteres" })
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, {
      message: "Nome deve conter apenas letras e espaços"
    })
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"]
});

// Booking validation schema
export const bookingSchema = z.object({
  className: z
    .string()
    .trim()
    .min(1, { message: "Nome da turma é obrigatório" })
    .max(50, { message: "Nome da turma deve ter menos de 50 caracteres" })
    .regex(/^[a-zA-Z0-9\s]+$/, {
      message: "Nome da turma deve conter apenas letras, números e espaços"
    }),
  quantity: z
    .number()
    .int({ message: "Quantidade deve ser um número inteiro" })
    .min(1, { message: "Quantidade deve ser pelo menos 1" })
    .max(200, { message: "Máximo de 200 Chromebooks por agendamento" }),
  bookingDate: z
    .date({
      required_error: "Data é obrigatória",
      invalid_type_error: "Data inválida"
    })
    .refine((date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date >= today;
    }, {
      message: "Data não pode ser no passado"
    })
    .refine((date) => {
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 3);
      return date <= maxDate;
    }, {
      message: "Não é possível agendar com mais de 3 meses de antecedência"
    })
    .refine((date) => {
      const dayOfWeek = date.getDay();
      return dayOfWeek >= 1 && dayOfWeek <= 5;
    }, {
      message: "Agendamentos só são permitidos de segunda a sexta-feira"
    }),
  timeSlots: z
    .array(z.string().trim().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/, {
      message: "Formato de horário inválido"
    }))
    .min(1, { message: "Pelo menos um horário deve ser selecionado" })
    .max(5, { message: "Máximo de 5 horários por agendamento" }),
  purpose: z.string().max(500, "Finalidade deve ter menos de 500 caracteres").optional(),
});

// Room booking validation schema
export const roomBookingSchema = z.object({
  room_type: z.string().min(1, "Tipo de sala é obrigatório"),
  class_name: z.string()
    .min(1, "Turma é obrigatória")
    .max(100, "Nome da turma muito longo"),
  booking_date: z.date({
    required_error: "Data é obrigatória",
  })
    .refine((date) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date >= today;
    }, {
      message: "Data não pode ser no passado",
    })
    .refine((date) => {
      const maxDate = new Date();
      maxDate.setMonth(maxDate.getMonth() + 3);
      return date <= maxDate;
    }, {
      message: "Agendamento não pode ser feito com mais de 3 meses de antecedência",
    })
    .refine((date) => {
      const dayOfWeek = date.getDay();
      return dayOfWeek !== 0 && dayOfWeek !== 6;
    }, {
      message: "Agendamentos só podem ser feitos em dias úteis",
    }),
  start_time: z.string().min(1, "Horário de início é obrigatório"),
  end_time: z.string().min(1, "Horário de término é obrigatório"),
  
  observations: z.string()
    .max(500, "Observações devem ter menos de 500 caracteres")
    .regex(/^[^<>{}]*$/, "Caracteres especiais não permitidos: < > { }")
    .optional()
    .transform(val => val?.trim()),
});

// Loan validation schema
export const loanSchema = z.object({
  borrower_name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  borrower_type: z.enum(["aluno", "professor", "colaborador"]),
  responsible_teacher: z.string().optional(),
  class_name: z.string().optional(),
  equipment_type: z.enum(["professor", "aluno"]),
  chromebook_number: z.string().optional(),
  quantity: z.number().int().min(1).max(200),
  loan_date: z.date(),
  pickup_time: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato inválido (HH:MM)"),
  expected_return_date: z.date().nullable().optional(),
  observations: z.string()
    .max(500, "Observações devem ter menos de 500 caracteres")
    .regex(/^[^<>{}]*$/, "Caracteres especiais não permitidos: < > { }")
    .optional()
    .transform(val => val?.trim()),
}).refine((data) => {
  if (data.borrower_type === "aluno") {
    return !!data.responsible_teacher && !!data.class_name;
  }
  return true;
}, {
  message: "Professor responsável e turma são obrigatórios para alunos",
  path: ["responsible_teacher"],
}).refine((data) => {
  if (data.quantity === 1) {
    return data.chromebook_number && data.chromebook_number.length > 0;
  }
  return true;
}, {
  message: "Selecione um Chromebook",
  path: ["chromebook_number"],
});

// Type exports
export type SignInFormData = z.infer<typeof signInSchema>;
export type SignUpFormData = z.infer<typeof signUpSchema>;
export type BookingFormData = z.infer<typeof bookingSchema>;
export type LoanFormData = z.infer<typeof loanSchema>;
export type RoomBookingFormData = z.infer<typeof roomBookingSchema>;
