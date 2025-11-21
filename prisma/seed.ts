import {
  PrismaClient,
  UserRole,
  CourseStatus,
  CourseLevel,
  MentorStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...");

  // 1. Create Admin User
  console.log("👤 Creating admin user...");
  const hashedAdminPassword = await bcrypt.hash("Admin@123456", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@lmsplatform.com" },
    update: {},
    create: {
      email: "admin@lmsplatform.com",
      password: hashedAdminPassword,
      full_name: "Admin User", // Changed from 'name' to 'full_name'
      role: UserRole.ADMIN,
      email_verified: true, // Changed from 'emailVerified'
      email_verified_at: new Date(), // Changed from 'emailVerifiedAt'
    },
  });
  console.log("✅ Admin created:", admin.email);

  // 2. Create Categories
  console.log("📚 Creating categories...");
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: "programming" },
      update: {},
      create: {
        name: "Programming",
        slug: "programming",
        description: "Learn programming languages and software development",
        icon: "💻",
        order: 1,
      },
    }),
    prisma.category.upsert({
      where: { slug: "design" },
      update: {},
      create: {
        name: "Design",
        slug: "design",
        description: "Graphic design, UI/UX, and creative skills",
        icon: "🎨",
        order: 2,
      },
    }),
    prisma.category.upsert({
      where: { slug: "business" },
      update: {},
      create: {
        name: "Business",
        slug: "business",
        description: "Business, marketing, and entrepreneurship",
        icon: "💼",
        order: 3,
      },
    }),
    prisma.category.upsert({
      where: { slug: "data-science" },
      update: {},
      create: {
        name: "Data Science",
        slug: "data-science",
        description: "Data analysis, machine learning, and AI",
        icon: "📊",
        order: 4,
      },
    }),
  ]);
  console.log(`✅ Created ${categories.length} categories`);

  // 3. Create Sample Mentor
  console.log("👨‍🏫 Creating sample mentor...");
  const hashedMentorPassword = await bcrypt.hash("Mentor@123456", 12);

  const mentor = await prisma.user.upsert({
    where: { email: "mentor@lmsplatform.com" },
    update: {},
    create: {
      email: "mentor@lmsplatform.com",
      password: hashedMentorPassword,
      full_name: "John Mentor", // Changed from 'name' to 'full_name'
      role: UserRole.MENTOR,
      email_verified: true, // Changed from 'emailVerified'
      email_verified_at: new Date(), // Changed from 'emailVerifiedAt'
      bio: "Experienced software developer with 10+ years in web development",
      mentor_profile: {
        // Changed from 'mentorProfile'
        create: {
          expertise: ["JavaScript", "TypeScript", "React", "Node.js"],
          experience: 10,
          education: "Bachelor of Computer Science",
          bio: "Passionate about teaching and helping students learn web development",
          headline: "Full Stack Web Developer & Instructor",
          status: MentorStatus.APPROVED,
          approved_at: new Date(), // Changed from 'approvedAt'
        },
      },
    },
  });
  console.log("✅ Mentor created:", mentor.email);

  // 4. Create Sample Students
  console.log("👨‍🎓 Creating sample students...");
  const hashedStudentPassword = await bcrypt.hash("Student@123456", 12);

  const students = await Promise.all([
    prisma.user.upsert({
      where: { email: "student1@lmsplatform.com" },
      update: {},
      create: {
        email: "student1@lmsplatform.com",
        password: hashedStudentPassword,
        full_name: "Alice Student", // Changed from 'name' to 'full_name'
        role: UserRole.STUDENT,
        email_verified: true, // Changed from 'emailVerified'
        email_verified_at: new Date(), // Changed from 'emailVerifiedAt'
      },
    }),
    prisma.user.upsert({
      where: { email: "student2@lmsplatform.com" },
      update: {},
      create: {
        email: "student2@lmsplatform.com",
        password: hashedStudentPassword,
        full_name: "Bob Student", // Changed from 'name' to 'full_name'
        role: UserRole.STUDENT,
        email_verified: true, // Changed from 'emailVerified'
        email_verified_at: new Date(), // Changed from 'emailVerifiedAt'
      },
    }),
  ]);
  console.log(`✅ Created ${students.length} students`);

  // 5. Create Sample Course
  console.log("📖 Creating sample course...");
  const mentorProfile = await prisma.mentorProfile.findUnique({
    where: { user_id: mentor.id }, // Changed from 'userId' to 'user_id'
  });

  if (mentorProfile) {
    const course = await prisma.course.create({
      data: {
        mentor_id: mentorProfile.id, // Changed from 'mentorId' to 'mentor_id'
        category_id: categories[0].id, // Changed from 'categoryId' to 'category_id'
        title: "Complete Web Development Bootcamp",
        slug: "complete-web-development-bootcamp",
        description:
          "Learn full stack web development from scratch. Build real-world projects with HTML, CSS, JavaScript, React, Node.js, and MongoDB.",
        short_description: "Master web development with hands-on projects", // Changed from 'shortDescription'
        level: CourseLevel.BEGINNER,
        language: "id",
        price: 499000,
        discount_price: 299000, // Changed from 'discountPrice'
        is_free: false, // Changed from 'isFree'
        is_premium: true, // Changed from 'isPremium'
        is_featured: true, // Changed from 'isFeatured'
        status: CourseStatus.PUBLISHED,
        published_at: new Date(), // Changed from 'publishedAt'
        requirements: [
          "Basic computer skills",
          "No programming experience required",
          "A computer with internet connection",
        ],
        what_you_will_learn: [
          // Changed from 'whatYouWillLearn'
          "HTML5 and CSS3 fundamentals",
          "JavaScript programming",
          "React.js for frontend development",
          "Node.js and Express for backend",
          "MongoDB database",
          "Building RESTful APIs",
          "Deploying web applications",
        ],
        target_audience: [
          // Changed from 'targetAudience'
          "Beginners who want to learn web development",
          "Anyone interested in becoming a full stack developer",
          "People looking to change careers to tech",
        ],
        tags: ["web development", "javascript", "react", "nodejs", "fullstack"],
        sections: {
          create: [
            {
              title: "Introduction to Web Development",
              description: "Get started with the basics of web development",
              order: 1,
              duration: 60,
            },
            {
              title: "HTML & CSS Fundamentals",
              description: "Learn the building blocks of web pages",
              order: 2,
              duration: 180,
            },
            {
              title: "JavaScript Essentials",
              description: "Master JavaScript programming language",
              order: 3,
              duration: 240,
            },
          ],
        },
      },
    });
    console.log("✅ Course created:", course.title);
  }

  // 6. Create System Settings
  console.log("⚙️ Creating system settings...");
  await Promise.all([
    prisma.systemSetting.upsert({
      where: { key: "platform_name" },
      update: {},
      create: {
        key: "platform_name",
        value: "LMS Platform",
        type: "string",
        category: "general",
        is_public: true, // Changed from 'isPublic'
      },
    }),
    prisma.systemSetting.upsert({
      where: { key: "platform_commission" },
      update: {},
      create: {
        key: "platform_commission",
        value: "20",
        type: "number",
        category: "payment",
        is_public: false, // Changed from 'isPublic'
      },
    }),
    prisma.systemSetting.upsert({
      where: { key: "max_video_size" },
      update: {},
      create: {
        key: "max_video_size",
        value: "524288000",
        type: "number",
        category: "upload",
        is_public: false, // Changed from 'isPublic'
      },
    }),
    prisma.systemSetting.upsert({
      where: { key: "certificate_enabled" },
      update: {},
      create: {
        key: "certificate_enabled",
        value: "true",
        type: "boolean",
        category: "features",
        is_public: true, // Changed from 'isPublic'
      },
    }),
  ]);
  console.log("✅ System settings created");

  console.log("✨ Database seeding completed successfully!");
  console.log("\n📝 Test Credentials:");
  console.log("Admin: admin@lmsplatform.com / Admin@123456");
  console.log("Mentor: mentor@lmsplatform.com / Mentor@123456");
  console.log("Student: student1@lmsplatform.com / Student@123456");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
