import type { Document, User, Company, Tag, DocumentCompany, DocumentTag, Vote, Comment, Reaction } from "@/generated/prisma/client";

export type DocumentWithRelations = Document & {
  author: Pick<User, "id" | "name" | "email">;
  companies: (DocumentCompany & { company: Company })[];
  tags: (DocumentTag & { tag: Tag })[];
  _count?: {
    comments: number;
    reactions: number;
  };
};

export type DocumentDetail = DocumentWithRelations & {
  comments: (Comment & { user: Pick<User, "id" | "name">; replies: (Comment & { user: Pick<User, "id" | "name"> })[] })[];
  reactions: Reaction[];
  incomingLinks: { sourceDoc: Pick<Document, "id" | "slug" | "title"> }[];
};

export type CompanyWithRelations = Company & {
  sector: { name: string; slug: string; region: { name: string; slug: string } };
  _count: { documents: number; votes: number };
};

export type VoteWithUser = Vote & {
  user: Pick<User, "id" | "name">;
};
