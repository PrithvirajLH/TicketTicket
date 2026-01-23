import {
  AccessLevel,
  MessageType,
  PrismaClient,
  TeamRole,
  TicketChannel,
  TicketPriority,
  TicketStatus,
  UserRole
} from '@prisma/client';

const prisma = new PrismaClient();

async function seedDev() {
  const teams = [
    { name: 'IT Service Desk', slug: 'it-service-desk', description: 'Devices, access, core systems' },
    { name: 'HR Operations', slug: 'hr-operations', description: 'People ops, onboarding, payroll' },
    { name: 'AI Enablement', slug: 'ai-enablement', description: 'AI tooling, models, data requests' },
    { name: 'Medicaid Pending', slug: 'medicaid-pending', description: 'Eligibility, claims, approvals' },
    { name: 'White Gloves', slug: 'white-gloves', description: 'Executive and VIP support' }
  ];

  const teamRecords = [] as { id: string; slug: string }[];
  for (const team of teams) {
    const record = await prisma.team.upsert({
      where: { slug: team.slug },
      update: { name: team.name, description: team.description },
      create: team
    });
    teamRecords.push({ id: record.id, slug: record.slug });
  }

  const categorySeeds = [
    { name: 'Access & Identity', slug: 'access-identity', description: 'SSO, VPN, permissions' },
    { name: 'Hardware & Devices', slug: 'hardware-devices', description: 'Laptops, peripherals' },
    { name: 'HR Operations', slug: 'hr-ops', description: 'People ops and onboarding' }
  ];

  const categoryRecords = [] as { id: string; slug: string }[];
  for (const category of categorySeeds) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, description: category.description },
      create: category
    });
    categoryRecords.push({ id: record.id, slug: record.slug });
  }

  const hrCategory = categoryRecords.find((category) => category.slug === 'hr-ops');
  if (hrCategory) {
    await prisma.category.upsert({
      where: { slug: 'hr-onboarding' },
      update: { name: 'Onboarding', description: 'New hire onboarding', parentId: hrCategory.id },
      create: {
        name: 'Onboarding',
        slug: 'hr-onboarding',
        description: 'New hire onboarding',
        parentId: hrCategory.id
      }
    });
  }

  const users = [
    {
      email: 'jane.doe@company.com',
      displayName: 'Jane Doe',
      department: 'Finance',
      location: 'New York, NY',
      role: UserRole.EMPLOYEE
    },
    {
      email: 'alex.park@company.com',
      displayName: 'Alex Park',
      department: 'IT',
      location: 'Remote',
      role: UserRole.AGENT
    },
    {
      email: 'maria.chen@company.com',
      displayName: 'Maria Chen',
      department: 'HR',
      location: 'Chicago, IL',
      role: UserRole.LEAD
    },
    {
      email: 'sam.rivera@company.com',
      displayName: 'Sam Rivera',
      department: 'AI',
      location: 'Austin, TX',
      role: UserRole.ADMIN
    }
  ];

  const userRecords = [] as { id: string; email: string }[];
  for (const user of users) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: user,
      create: user
    });
    userRecords.push({ id: record.id, email: record.email });
  }

  const jane = userRecords.find((user) => user.email === 'jane.doe@company.com');
  const alex = userRecords.find((user) => user.email === 'alex.park@company.com');
  const maria = userRecords.find((user) => user.email === 'maria.chen@company.com');
  const sam = userRecords.find((user) => user.email === 'sam.rivera@company.com');

  if (!jane || !alex || !maria || !sam) {
    throw new Error('Seed users missing');
  }

  const itTeam = teamRecords.find((team) => team.slug === 'it-service-desk');
  const hrTeam = teamRecords.find((team) => team.slug === 'hr-operations');
  const aiTeam = teamRecords.find((team) => team.slug === 'ai-enablement');
  const medicaidTeam = teamRecords.find((team) => team.slug === 'medicaid-pending');
  const vipTeam = teamRecords.find((team) => team.slug === 'white-gloves');

  if (!itTeam || !hrTeam || !aiTeam || !medicaidTeam || !vipTeam) {
    throw new Error('Seed teams missing');
  }

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: itTeam.id, userId: alex.id } },
    update: { role: TeamRole.AGENT },
    create: { teamId: itTeam.id, userId: alex.id, role: TeamRole.AGENT }
  });

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: hrTeam.id, userId: maria.id } },
    update: { role: TeamRole.LEAD },
    create: { teamId: hrTeam.id, userId: maria.id, role: TeamRole.LEAD }
  });

  await prisma.teamMember.upsert({
    where: { teamId_userId: { teamId: aiTeam.id, userId: sam.id } },
    update: { role: TeamRole.ADMIN },
    create: { teamId: aiTeam.id, userId: sam.id, role: TeamRole.ADMIN }
  });

  await prisma.routingRule.createMany({
    data: [
      {
        name: 'HR onboarding and benefits',
        teamId: hrTeam.id,
        keywords: ['hr', 'onboard', 'benefits'],
        priority: 10,
        isActive: true
      },
      {
        name: 'IT access and devices',
        teamId: itTeam.id,
        keywords: ['vpn', 'laptop', 'device', 'it'],
        priority: 20,
        isActive: true
      }
    ],
    skipDuplicates: true
  });

  const tickets = [
    {
      subject: 'VPN access for new contractor',
      description: 'Need VPN access for contractor starting Monday. Please provision and confirm MFA setup.',
      priority: TicketPriority.P2,
      status: TicketStatus.TRIAGED,
      channel: TicketChannel.PORTAL,
      requesterId: jane.id,
      assignedTeamId: itTeam.id,
      assigneeId: alex.id
    },
    {
      subject: 'Update AI model access policy',
      description: 'Review and update the approval workflow for external model usage.',
      priority: TicketPriority.P3,
      status: TicketStatus.IN_PROGRESS,
      channel: TicketChannel.PORTAL,
      requesterId: sam.id,
      assignedTeamId: aiTeam.id,
      assigneeId: sam.id
    },
    {
      subject: 'Medicaid pending claim follow-up',
      description: 'Claim #MP-44821 requires an eligibility verification update.',
      priority: TicketPriority.P1,
      status: TicketStatus.ASSIGNED,
      channel: TicketChannel.EMAIL,
      requesterId: jane.id,
      assignedTeamId: medicaidTeam.id
    },
    {
      subject: 'Executive laptop replacement',
      description: 'White glove request: replace executive laptop before travel.',
      priority: TicketPriority.P2,
      status: TicketStatus.NEW,
      channel: TicketChannel.PORTAL,
      requesterId: jane.id,
      assignedTeamId: vipTeam.id
    }
  ];

  for (const ticket of tickets) {
    const createdTicket = await prisma.ticket.create({
      data: ticket
    });

    await prisma.ticketMessage.create({
      data: {
        ticketId: createdTicket.id,
        authorId: ticket.requesterId,
        type: MessageType.PUBLIC,
        body: 'Initial request submitted through the portal.'
      }
    });

    await prisma.ticketEvent.create({
      data: {
        ticketId: createdTicket.id,
        type: 'TICKET_CREATED',
        payload: { subject: ticket.subject, priority: ticket.priority }
      }
    });
  }
}

async function seedTest() {
  const ids = {
    teamIt: '11111111-1111-4111-8111-111111111111',
    teamHr: '22222222-2222-4222-8222-222222222222',
    requester: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    otherRequester: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    agent: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    lead: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    admin: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  };

  await prisma.ticketAccess.deleteMany();
  await prisma.ticketEvent.deleteMany();
  await prisma.ticketMessage.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.user.deleteMany();
  await prisma.team.deleteMany();
  await prisma.category.deleteMany();

  await prisma.team.createMany({
    data: [
      { id: ids.teamIt, name: 'IT Service Desk', slug: 'it-service-desk', description: 'IT ops' },
      { id: ids.teamHr, name: 'HR Operations', slug: 'hr-operations', description: 'HR ops' }
    ]
  });

  await prisma.category.createMany({
    data: [
      { id: 'c1111111-1111-4111-8111-111111111111', name: 'Access & Identity', slug: 'access-identity' },
      { id: 'c2222222-2222-4222-8222-222222222222', name: 'Hardware & Devices', slug: 'hardware-devices' }
    ]
  });

  await prisma.user.createMany({
    data: [
      {
        id: ids.requester,
        email: 'requester@company.com',
        displayName: 'Requestor One',
        role: UserRole.EMPLOYEE,
        department: 'Finance',
        location: 'Remote'
      },
      {
        id: ids.otherRequester,
        email: 'other.requester@company.com',
        displayName: 'Requestor Two',
        role: UserRole.EMPLOYEE,
        department: 'HR',
        location: 'Remote'
      },
      {
        id: ids.agent,
        email: 'agent@company.com',
        displayName: 'Agent One',
        role: UserRole.AGENT,
        department: 'IT',
        location: 'Remote'
      },
      {
        id: ids.lead,
        email: 'lead@company.com',
        displayName: 'Lead One',
        role: UserRole.LEAD,
        department: 'IT',
        location: 'Remote'
      },
      {
        id: ids.admin,
        email: 'admin@company.com',
        displayName: 'Admin One',
        role: UserRole.ADMIN,
        department: 'Security',
        location: 'Remote'
      }
    ]
  });

  await prisma.teamMember.createMany({
    data: [
      { id: 'e1111111-1111-1111-1111-111111111111', teamId: ids.teamIt, userId: ids.agent, role: TeamRole.AGENT },
      { id: 'e2222222-2222-2222-2222-222222222222', teamId: ids.teamIt, userId: ids.lead, role: TeamRole.LEAD }
    ]
  });

  const ticketAssigned = await prisma.ticket.create({
    data: {
      subject: 'VPN access request',
      description: 'Need VPN access for contractor',
      status: TicketStatus.ASSIGNED,
      priority: TicketPriority.P2,
      channel: TicketChannel.PORTAL,
      requesterId: ids.requester,
      assignedTeamId: ids.teamIt,
      assigneeId: ids.agent
    }
  });

  const ticketUnassigned = await prisma.ticket.create({
    data: {
      subject: 'Laptop provisioning',
      description: 'Need a new laptop',
      status: TicketStatus.NEW,
      priority: TicketPriority.P3,
      channel: TicketChannel.PORTAL,
      requesterId: ids.requester,
      assignedTeamId: ids.teamIt
    }
  });

  await prisma.ticket.create({
    data: {
      subject: 'HR onboarding',
      description: 'New hire onboarding package',
      status: TicketStatus.TRIAGED,
      priority: TicketPriority.P2,
      channel: TicketChannel.EMAIL,
      requesterId: ids.requester,
      assignedTeamId: ids.teamHr
    }
  });

  await prisma.ticket.create({
    data: {
      subject: 'Benefits update',
      description: 'Update medical coverage information.',
      status: TicketStatus.NEW,
      priority: TicketPriority.P3,
      channel: TicketChannel.PORTAL,
      requesterId: ids.otherRequester,
      assignedTeamId: ids.teamHr
    }
  });

  await prisma.ticketMessage.createMany({
    data: [
      {
        ticketId: ticketAssigned.id,
        authorId: ids.requester,
        type: MessageType.PUBLIC,
        body: 'Initial request.'
      },
      {
        ticketId: ticketUnassigned.id,
        authorId: ids.requester,
        type: MessageType.PUBLIC,
        body: 'Please provide a laptop.'
      }
    ]
  });

  await prisma.ticketEvent.createMany({
    data: [
      {
        ticketId: ticketAssigned.id,
        type: 'TICKET_CREATED',
        payload: { subject: ticketAssigned.subject }
      },
      {
        ticketId: ticketUnassigned.id,
        type: 'TICKET_CREATED',
        payload: { subject: ticketUnassigned.subject }
      }
    ]
  });

  await prisma.ticketAccess.create({
    data: {
      ticketId: ticketAssigned.id,
      teamId: ids.teamHr,
      accessLevel: AccessLevel.READ
    }
  });
}

async function seed() {
  if (process.env.SEED_MODE === 'test' || process.env.NODE_ENV === 'test') {
    await seedTest();
    return;
  }

  await seedDev();
}

seed()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
