"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { supabase } from "@/integrations/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Loader2, User, Lock, Camera, Mail, Phone, AtSign } from "lucide-react"
import { Icon } from "@iconify/react"
import { useRef } from "react"

interface ProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: {
    id: string
    email: string
    name: string
    avatar?: string
  }
  onProfileUpdated?: () => void
}

export function ProfileDialog({
  open,
  onOpenChange,
  user,
  onProfileUpdated,
}: ProfileDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadingPassword, setLoadingPassword] = useState(false)
  const [activeTab, setActiveTab] = useState("profile")
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Profile fields
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [phone, setPhone] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  useEffect(() => {
    if (open && user) {
      fetchProfile()
    }
  }, [open, user])

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) throw error

      setFullName(data.full_name || "")
      setUsername(data.username || "")
      setAvatarUrl(data.avatar_url || "")
      // Phone não existe na tabela atual, mas podemos adicionar depois
      setPhone("")
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validar tipo de arquivo - aceitar todos os formatos de imagem incluindo HEIC
    const validImageTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'image/bmp',
      'image/tiff',
      'image/heic',
      'image/heif',
      'image/avif'
    ]
    
    // Verificar pela extensão também (para HEIC que pode não ter MIME type correto)
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif', 'heic', 'heif', 'avif']
    
    const isValidType = validImageTypes.includes(file.type) || validExtensions.includes(fileExtension || '')
    
    if (!isValidType) {
      toast({
        title: "Erro",
        description: "Por favor, selecione uma imagem válida.",
        variant: "destructive",
      })
      return
    }

    // Validar tamanho (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Erro",
        description: "A imagem deve ter no máximo 2MB.",
        variant: "destructive",
      })
      return
    }

    setUploadingAvatar(true)

    try {
      // Criar nome único para o arquivo
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload para o Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      setAvatarUrl(publicUrl)

      toast({
        title: "Foto atualizada!",
        description: "Clique em 'Salvar Alterações' para confirmar.",
      })
    } catch (error: any) {
      console.error('Error uploading avatar:', error)
      toast({
        title: "Erro ao enviar foto",
        description: error.message || "Não foi possível enviar a imagem.",
        variant: "destructive",
      })
    } finally {
      setUploadingAvatar(false)
      // Limpar input para permitir selecionar o mesmo arquivo novamente
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      toast({
        title: "Erro",
        description: "O nome é obrigatório",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          username: username.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        })
        .eq('user_id', user.id)

      if (error) throw error

      toast({
        title: "Perfil atualizado!",
        description: "Suas informações foram salvas com sucesso.",
      })

      onProfileUpdated?.()
      onOpenChange(false) // Fechar o dialog após salvar
    } catch (error: any) {
      console.error('Error updating profile:', error)
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o perfil.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos de senha",
        variant: "destructive",
      })
      return
    }

    if (newPassword.length < 6) {
      toast({
        title: "Erro",
        description: "A nova senha deve ter pelo menos 6 caracteres",
        variant: "destructive",
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      })
      return
    }

    setLoadingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      toast({
        title: "Senha alterada!",
        description: "Sua senha foi atualizada com sucesso.",
      })

      // Limpar campos
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      console.error('Error changing password:', error)
      toast({
        title: "Erro ao alterar senha",
        description: error.message || "Não foi possível alterar a senha.",
        variant: "destructive",
      })
    } finally {
      setLoadingPassword(false)
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="solar:user-circle-bold-duotone" className="h-6 w-6 text-primary" />
            Meu Perfil
          </DialogTitle>
          <DialogDescription>
            Gerencie suas informações pessoais e configurações de segurança.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Dados Pessoais
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Segurança
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 mt-4">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar className="h-24 w-24 border-4 border-primary/20">
                  <AvatarImage src={avatarUrl} alt={fullName} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {getInitials(fullName || user.name)}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 p-1.5 bg-primary rounded-full text-white cursor-pointer hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.heic,.heif"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Clique no ícone para alterar a foto
              </p>
            </div>

            {/* Nome Completo */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Nome Completo *
              </Label>
              <Input
                id="fullName"
                placeholder="Seu nome completo"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            {/* Username */}
            <div className="space-y-2">
              <Label htmlFor="username" className="flex items-center gap-2">
                <AtSign className="h-4 w-4 text-muted-foreground" />
                Nome de Usuário
              </Label>
              <Input
                id="username"
                placeholder="seu_usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, '_'))}
              />
            </div>

            {/* Email (somente leitura) */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Email
              </Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="bg-muted/50"
              />
              <p className="text-xs text-muted-foreground">
                O email não pode ser alterado
              </p>
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Icon icon="solar:diskette-bold-duotone" className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="security" className="space-y-4 mt-4">
            <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Icon icon="solar:shield-warning-bold-duotone" className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800 dark:text-amber-300">Alterar Senha</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Escolha uma senha forte com pelo menos 6 caracteres.
                  </p>
                </div>
              </div>
            </div>

            {/* Nova Senha */}
            <div className="space-y-2">
              <Label htmlFor="newPassword" className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Nova Senha *
              </Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Digite sua nova senha"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            {/* Confirmar Nova Senha */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                <Icon icon="solar:lock-password-line-duotone" className="h-4 w-4 text-muted-foreground" />
                Confirmar Nova Senha *
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirme sua nova senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {/* Indicador de força da senha */}
            {newPassword && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`h-2 flex-1 rounded-full ${newPassword.length >= 6 ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className={`text-xs ${newPassword.length >= 6 ? 'text-green-600' : 'text-red-600'}`}>
                    {newPassword.length >= 6 ? 'Senha válida' : 'Mínimo 6 caracteres'}
                  </span>
                </div>
                {newPassword && confirmPassword && (
                  <div className="flex items-center gap-2">
                    {newPassword === confirmPassword ? (
                      <>
                        <Icon icon="solar:check-circle-bold" className="h-4 w-4 text-green-500" />
                        <span className="text-xs text-green-600">Senhas coincidem</span>
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:close-circle-bold" className="h-4 w-4 text-red-500" />
                        <span className="text-xs text-red-600">Senhas não coincidem</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleChangePassword}
              disabled={loadingPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6}
              className="w-full"
              variant="default"
            >
              {loadingPassword ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Alterando...
                </>
              ) : (
                <>
                  <Icon icon="solar:key-bold-duotone" className="h-4 w-4 mr-2" />
                  Alterar Senha
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}