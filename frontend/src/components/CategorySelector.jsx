// src/components/CategorySelector.jsx
import React, { useMemo } from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './CategorySelector.css'; // Stil dosyasını import ettiğinizden emin olun

// ========================================================================
// Kategori Öğesi Bileşeni
// ========================================================================
// Props: category (isDifficultCategory içerir), onSelect, learnedCardIds
function CategoryItem({ category, onSelect, learnedCardIds }) {

    // Kategori ilerlemesini hesapla (learnedCardIds prop'unu kullanarak)
    // Zor kategoriler için ilerleme hesaplanmaz (veya farklı hesaplanabilir)
    const { learnedCount, totalCards, progressPercent, isCompleted } = useMemo(() => {
        // Zor kategori için ilerleme hesaplamasını atla
        if (category.isDifficultCategory) {
            return { learnedCount: 0, totalCards: category.cards?.length || 0, progressPercent: 0, isCompleted: false };
        }

        const cards = category.cards || [];
        const total = cards.length;
        let learned = 0;

        if (total > 0 && learnedCardIds instanceof Set) {
            cards.forEach(card => { if (card?.id && learnedCardIds.has(card.id)) learned++; });
        }

        const percent = total > 0 ? Math.round((learned / total) * 100) : 0;
        // Zor olmayan kategoriler için tamamlama durumu
        const completed = !category.isDifficultCategory && learned === total && total > 0;

        return { learnedCount: learned, totalCards: total, progressPercent: percent, isCompleted: completed };
    }, [category.cards, category.title, category.isDifficultCategory, learnedCardIds]); // Bağımlılıklar güncellendi

    // İlerleme çubuğu stili (Sadece normal kategoriler için anlamlı)
    const progressBarStyle = {
        width: `${progressPercent}%`,
        backgroundColor: isCompleted ? 'var(--bs-success)' : 'var(--bs-primary)',
    };

    // Kategoriye özel ikon seçimi
    let iconClass = "bi bi-box-seam-fill"; // Varsayılan ikon
    const lowerCaseTitle = category.title.toLowerCase();

    // *** Zor kategori için özel ikon ***
    if (category.isDifficultCategory) {
        iconClass = "bi bi-star-fill text-warning"; // Yıldız ikonu
    } else if (isCompleted) { // Normal kategori tamamlanmışsa
        iconClass = "bi bi-check-lg"; // Yeşil check ikonu CSS ile sağlanabilir
    } else {
        // --- Diğer Normal Kategori İkonları ---
        if (lowerCaseTitle.includes("selam") || lowerCaseTitle.includes("tanışma")) iconClass = "bi bi-people-fill";
        else if (lowerCaseTitle.includes("sayılar")) iconClass = "bi bi-hash";
        else if (lowerCaseTitle.includes("renkler")) iconClass = "bi bi-palette-fill";
        else if (lowerCaseTitle.includes("günler") || lowerCaseTitle.includes("aylar") || lowerCaseTitle.includes("mevsimler") || lowerCaseTitle.includes("zaman")) iconClass = "bi bi-calendar-week-fill";
        else if (lowerCaseTitle.includes("aile")) iconClass = "bi bi-house-heart-fill";
        else if (lowerCaseTitle.includes("yiyecek") || lowerCaseTitle.includes("içecek") || lowerCaseTitle.includes("restoran") || lowerCaseTitle.includes("yemek")) iconClass = "bi bi-egg-fried";
        else if (lowerCaseTitle.includes("yerler") || lowerCaseTitle.includes("mekân")) iconClass = "bi bi-geo-alt-fill";
        else if (lowerCaseTitle.includes("fiiller")) iconClass = "bi bi-lightning-charge-fill";
        else if (lowerCaseTitle.includes("sıfatlar")) iconClass = "bi bi-vector-pen";
        else if (lowerCaseTitle.includes("zamirler")) iconClass = "bi bi-person-badge-fill";
        else if (lowerCaseTitle.includes("vücut") || lowerCaseTitle.includes("sağlık")) iconClass = "bi bi-heart-pulse-fill";
        else if (lowerCaseTitle.includes("edatlar")) iconClass = "bi bi-link-45deg";
        else if (lowerCaseTitle.includes("alışveriş") || lowerCaseTitle.includes("kıyafet")) iconClass = "bi bi-cart-fill";
        else if (lowerCaseTitle.includes("seyahat") || lowerCaseTitle.includes("ulaşım")) iconClass = "bi bi-airplane-fill";
        else if (lowerCaseTitle.includes("hava")) iconClass = "bi bi-cloud-sun-fill";
        // ... (diğer ikon eşleştirmeleri eklenebilir) ...
        else if (lowerCaseTitle.includes("dilbilgisi") || lowerCaseTitle.includes("yapılar")) iconClass = "bi bi-puzzle-fill";
    }

    return (
        <div className="category-item-wrapper col-6 col-sm-4 col-md-3 col-lg-3 col-xl-2">
            <button
                // Zor kategori için veya tamamlanmış normal kategori için özel class'lar
                className={`category-item btn w-100 h-100 p-0 ${isCompleted ? 'completed' : ''} ${category.isDifficultCategory ? 'difficult-category' : ''}`}
                // Boş kategoriler tıklanamaz
                onClick={() => totalCards > 0 && onSelect(category)}
                // Başlıkta kart sayısı gösterilir (zor kategori için öğrenilen/toplam yerine)
                title={`${category.title} (${category.isDifficultCategory ? totalCards : learnedCount + '/' + totalCards})`}
                disabled={totalCards === 0} // Boşsa disable
            >
                {/* Üst Kısım: İkon ve Başlık */}
                <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center w-100 pt-2 px-1">
                    <div className="category-icon mb-2">
                        <i className={`${iconClass} fs-1`}></i> {/* İkon sınıfı dinamik */}
                    </div>
                    <div className="category-title">{category.title}</div>
                </div>

                {/* Alt Kısım: İlerleme Çubuğu veya Kart Sayısı */}
                {/* Zor kategori için ilerleme çubuğu gösterilmez, sadece kart sayısı */}
                {!category.isDifficultCategory && totalCards > 0 ? (
                    <div className="category-progress-bar-container mt-auto" title={`${Math.round(progressPercent)}% tamamlandı`}>
                        <div className="category-progress-bar" style={progressBarStyle}></div>
                    </div>
                ) : category.isDifficultCategory && totalCards > 0 ? (
                     <div className="small text-muted mt-auto pb-1" style={{ fontSize: '0.7rem' }}>
                          ({totalCards} Kart) {/* Sadece toplam kart sayısı */}
                     </div>
                 ) : totalCards === 0 ? ( // Normal ama boş kategori
                    <div className="small text-muted mt-auto pb-1" style={{ fontSize: '0.7rem' }}>
                         (Boş)
                     </div>
                 ) : null}
            </button>
        </div>
    );
}

// ========================================================================
// Ana Kategori Seçici Bileşeni
// ========================================================================
// Props: categories (zor kategori dahil), onSelectCategory, learnedCardIds, searchTerm
function CategorySelector({ categories, onSelectCategory, learnedCardIds, searchTerm }) {
    // Kategorileri filtrele (Arama terimine göre)
    const filteredCategories = useMemo(() => {
        // Arama yoksa veya kategoriler boşsa direkt döndür
        if (!searchTerm || !categories || categories.length === 0) {
            return categories || [];
        }
        const lowerSearchTerm = searchTerm.toLowerCase();
        // Başlığa göre filtrele
        return categories.filter(cat => cat?.title?.toLowerCase().includes(lowerSearchTerm));
    }, [categories, searchTerm]);

    // Gösterilecek kategori yoksa mesaj göster
    if (!filteredCategories || filteredCategories.length === 0) {
        // Arama yapılıyorsa farklı, hiç kategori yoksa farklı mesaj
        if (searchTerm) {
            return <p className="text-center text-muted mt-5">"{searchTerm}" ile eşleşen kategori bulunamadı.</p>;
        } else {
             return <p className="text-center text-muted mt-5">Bu seviye için gösterilecek kategori yok veya yükleniyor...</p>;
        }
    }

    return (
        <div className="category-selector-container mt-4">
            <div className="row justify-content-center g-3">
                {filteredCategories.map((category) => (
                    // CategoryItem'a gerekli prop'ları aktar
                    <CategoryItem
                        // Key olarak category.id kullanmak önemli
                        key={category.id || category.title} // ID yoksa başlığı kullan (fallback)
                        category={category} // Kategori objesinin tamamını gönder
                        onSelect={onSelectCategory}
                        learnedCardIds={learnedCardIds} // İlerleme takibi için
                    />
                ))}
            </div>
        </div>
    );
}

export default CategorySelector;