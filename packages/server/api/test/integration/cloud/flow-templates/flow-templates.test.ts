import { rolePermissions } from '@activepieces/ee-shared'
import {
    apId,
    PlatformRole,
    PrincipalType,
    ProjectMemberRole,
    ProjectRole,
    RoleType,
    TemplateType,
} from '@activepieces/shared'
import dayjs from 'dayjs'
import { FastifyInstance } from 'fastify'
import { StatusCodes } from 'http-status-codes'
import { databaseConnection } from '../../../../src/app/database/database-connection'
import { setupServer } from '../../../../src/app/server'
import { generateMockToken } from '../../../helpers/auth'
import {
    CLOUD_PLATFORM_ID,
    createMockTemplate,
    createMockUser,
    mockBasicSetup,
} from '../../../helpers/mocks'

let app: FastifyInstance | null = null

beforeAll(async () => {
    await databaseConnection().initialize()
    app = await setupServer()

    for (const role of Object.values(ProjectMemberRole)) {
        const projectRole: ProjectRole = {
            name: role,
            permissions: rolePermissions[role],
            type: RoleType.DEFAULT,
            id: apId(),
            created: dayjs().toISOString(),
            updated: dayjs().toISOString(),
        }
        await databaseConnection().getRepository('project_role').save(projectRole)
    }  
})

afterAll(async () => {
    await databaseConnection().destroy()
    await app?.close()
})

describe('Flow Templates', () => {
    describe('List Flow Templates', () => {
        it('should list platform templates only', async () => {
            // arrange
            const { mockPlatform, mockUser, mockPlatformTemplate } =
                await createMockPlatformTemplate({ platformId: apId() })

            const testToken = await generateMockToken({
                type: PrincipalType.USER,
                id: mockUser.id,
                platform: { id: mockPlatform.id },
            })

            const response = await app?.inject({
                method: 'GET',
                url: '/v1/flow-templates',
                headers: {
                    authorization: `Bearer ${testToken}`,
                },
            })

            // assert
            expect(response?.statusCode).toBe(StatusCodes.OK)
            const responseBody = response?.json()
            expect(responseBody.data).toHaveLength(1)
            expect(responseBody.data[0].id).toBe(mockPlatformTemplate.id)
        })

        it('should list cloud platform template for anonymous users', async () => {
            // arrange
            const { mockPlatformTemplate } = await createMockPlatformTemplate({
                platformId: CLOUD_PLATFORM_ID,
            })
            await createMockPlatformTemplate({
                platformId: apId(),
            })

            const response = await app?.inject({
                method: 'GET',
                url: '/v1/flow-templates',
            })

            // assert
            expect(response?.statusCode).toBe(StatusCodes.OK)
            const responseBody = response?.json()
            expect(responseBody.data).toHaveLength(1)
            expect(responseBody.data[0].id).toBe(mockPlatformTemplate.id)
        })
    })

    describe('Delete Flow Template', () => {
        it('should not be able delete platform template as member', async () => {
            // arrange
            const { mockUser, mockPlatform, mockPlatformTemplate } =
                await createMockPlatformTemplate({ platformId: apId() })
            const testToken = await generateMockToken({
                id: mockUser.id,
                type: PrincipalType.USER,
                platform: { id: mockPlatform.id },
            })

            const response = await app?.inject({
                method: 'DELETE',
                url: `/v1/flow-templates/${mockPlatformTemplate.id}`,
                headers: {
                    authorization: `Bearer ${testToken}`,
                },
            })

            // assert
            expect(response?.statusCode).toBe(StatusCodes.FORBIDDEN)
        })

        it('should be able delete platform template as owner', async () => {
            // arrange
            const { mockPlatform, mockOwner, mockPlatformTemplate } =
                await createMockPlatformTemplate({ platformId: apId() })

            const testToken = await generateMockToken({
                type: PrincipalType.USER,
                id: mockOwner.id,
                platform: { id: mockPlatform.id },
            })

            const response = await app?.inject({
                method: 'DELETE',
                url: `/v1/flow-templates/${mockPlatformTemplate.id}`,
                headers: {
                    authorization: `Bearer ${testToken}`,
                },
            })

            // assert
            expect(response?.statusCode).toBe(StatusCodes.NO_CONTENT)
        })

        it('should not delete platform template when not authenticated', async () => {
            // arrange
            const { mockPlatformTemplate } = await createMockPlatformTemplate({
                platformId: CLOUD_PLATFORM_ID,
            })

            const response = await app?.inject({
                method: 'DELETE',
                url: `/v1/flow-templates/${mockPlatformTemplate.id}`,
            })

            // assert
            expect(response?.statusCode).toBe(StatusCodes.FORBIDDEN)
        })
    })
})

async function createMockPlatformTemplate({ platformId }: { platformId: string }) {
    const { mockOwner, mockPlatform, mockProject } = await mockBasicSetup({
        platform: {
            id: platformId,
            manageTemplatesEnabled: true,
        },
    })

    const mockPlatformTemplate = createMockTemplate({
        platformId: mockPlatform.id,
        projectId: mockProject.id,
        type: TemplateType.PLATFORM,
    })
    await databaseConnection()
        .getRepository('flow_template')
        .save(mockPlatformTemplate)

    const mockUser = createMockUser({
        platformId: mockPlatform.id,
        platformRole: PlatformRole.MEMBER,
    })
    await databaseConnection().getRepository('user').save(mockUser)

    return { mockOwner, mockUser, mockPlatform, mockProject, mockPlatformTemplate }
}
