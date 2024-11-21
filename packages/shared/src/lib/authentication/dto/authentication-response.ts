import { ProjectRole } from '../../project-role/project-role'
import { User } from '../../user/user'

export type UserWithoutPassword = Omit<User, 'password'>

export type AuthenticationResponse = UserWithoutPassword & {
    token: string
    projectId: string
    projectRole: ProjectRole
}
