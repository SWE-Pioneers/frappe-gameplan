import frappe


def execute():
	bento_card = frappe.qb.DocType("GP Profile Bento Card")
	(
		frappe.qb.update(bento_card)
		.set(bento_card.type, "Card")
		.where(bento_card.type.isin(["Text", "Image"]))
	).run()
