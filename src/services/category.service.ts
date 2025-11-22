import prisma from "@/lib/prisma";

export class CategoryService {
  /**
   * Get all categories
   */
  async getAllCategories(includeInactive: boolean = false) {
    const categories = await prisma.category.findMany({
      where: includeInactive ? {} : { is_active: true },
      orderBy: [{ order: "asc" }, { name: "asc" }],
      include: {
        children: {
          where: includeInactive ? {} : { is_active: true },
          orderBy: { order: "asc" },
        },
      },
    });

    // Filter only top-level categories dengan tipe yang benar
    const topLevelCategories = categories.filter((cat: any) => !cat.parent_id);

    return topLevelCategories;
  }
}

const categoryService = new CategoryService();
export default categoryService;
